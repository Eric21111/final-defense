const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Product = require('./models/Product');


const connectDB = async () => {
    try {
        const mongoUri = String(process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
        if (!mongoUri) {
            console.error("Set MONGODB_URI or MONGO_URI in .env before running this script.");
            process.exit(1);
        }

        const conn = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const migrate = async () => {
    await connectDB();
    console.log("Starting category migration...");

    try {
        const products = await Product.find({}).lean();
        let migratedCount = 0;

        for (const product of products) {

            if (product.genderCategory !== undefined || product.subCategory === undefined) {
                let newCategory = product.genderCategory || "Unisex";


                if (newCategory === "Male") newCategory = "Apparel - Men";
                else if (newCategory === "Female") newCategory = "Apparel - Women";
                else if (newCategory === "Kids") newCategory = "Apparel - Kids";
                else if (newCategory === "Unisex") {
                    if (product.category === "Foods") newCategory = "Foods";
                    else if (product.category === "Makeup") newCategory = "Makeup";
                    else newCategory = "Apparel - Unisex";
                }

                let newSubCategory = product.category || "Others";


                if (product.category === "Foods" && product.foodSubtype) {
                    newSubCategory = product.foodSubtype;
                }

                console.log(`Migrating product SKU: ${product.sku} | Old: ${product.category} + ${product.genderCategory} -> New: ${newCategory} -> ${newSubCategory}`);

                await Product.updateOne({ _id: product._id }, {
                    $set: { category: newCategory, subCategory: newSubCategory },
                    $unset: { genderCategory: "", foodSubtype: "" }
                }, { strict: false });

                migratedCount++;
            }
        }

        console.log(`Migration complete! Successfully migrated ${migratedCount} products.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrate();
