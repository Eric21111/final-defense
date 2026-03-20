import { memo, useMemo } from "react";
import { MdCategory } from "react-icons/md";
import { useTheme } from "../../context/ThemeContext";

const ProductCard = memo(function ProductCard({ product, onToggleExpand }) {
  const { theme } = useTheme();


  const getSizeQuantity = (sizeData) => {
    if (
    typeof sizeData === "object" &&
    sizeData !== null &&
    sizeData.quantity !== undefined)
    {
      return sizeData.quantity;
    }
    return typeof sizeData === "number" ? sizeData : 0;
  };


  const getAllPricesFromSizeData = (sizeData) => {
    const prices = [];

    if (typeof sizeData !== "object" || sizeData === null) {
      return prices;
    }


    if (sizeData.price !== undefined && sizeData.price > 0) {
      prices.push(sizeData.price);
    }


    if (sizeData.variantPrices && typeof sizeData.variantPrices === "object") {
      Object.values(sizeData.variantPrices).forEach((price) => {
        if (price > 0) prices.push(price);
      });
    }


    if (sizeData.variants && typeof sizeData.variants === "object") {
      Object.values(sizeData.variants).forEach((variantData) => {
        if (typeof variantData === "object" && variantData !== null && variantData.price > 0) {
          prices.push(variantData.price);
        }
      });
    }

    return prices;
  };


  const getSizePrice = (sizeData) => {
    if (
    typeof sizeData === "object" &&
    sizeData !== null &&
    sizeData.price !== undefined)
    {
      return sizeData.price;
    }
    return null;
  };


  const priceRange = useMemo(() => {
    if (product.sizes && typeof product.sizes === "object") {
      const prices = [];

      Object.values(product.sizes).forEach((sizeData) => {

        const sizePrices = getAllPricesFromSizeData(sizeData);
        prices.push(...sizePrices);


        const simplePrice = getSizePrice(sizeData);
        if (simplePrice !== null && simplePrice > 0 && !prices.includes(simplePrice)) {
          prices.push(simplePrice);
        }
      });

      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        if (minPrice !== maxPrice) {
          return { min: minPrice, max: maxPrice, isRange: true };
        }
        return { min: minPrice, max: maxPrice, isRange: false };
      }
    }


    return {
      min: product.itemPrice || 0,
      max: product.itemPrice || 0,
      isRange: false
    };
  }, [product.sizes, product.itemPrice]);


  const displayStock = useMemo(() => {
    if (typeof product.currentStock === "number") {
      return product.currentStock;
    }

    if (product.sizes && typeof product.sizes === "object") {
      return Object.values(product.sizes).reduce(
        (sum, sizeData) => sum + getSizeQuantity(sizeData),
        0
      );
    }
    return product.currentStock || 0;
  }, [product.currentStock, product.sizes]);

  return (
    <div
      className={`mb-4 rounded-2xl transition-all duration-300 ease-out overflow-hidden border-4 shadow hover:shadow-xl hover:border-[#09A046] cursor-pointer ${theme === "dark" ?
      "bg-[#1E1B18] border-gray-700" :
      "bg-white border-gray-200"}`
      }
      onClick={() => onToggleExpand(product)}>
      
      <div
        className={`aspect-square flex items-center justify-center overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-100"}`
        }>
        
        {product.itemImage && product.itemImage.trim() !== "" ?
        <img
          src={product.itemImage}
          alt={product.itemName}
          className="w-full h-full object-cover" /> :


        <MdCategory
          className={`text-4xl ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`} />

        }
      </div>

      <div className="p-3">
        <h3
          className={`font-medium text-sm mb-1 truncate ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          
          {product.itemName}
        </h3>
        <div className="flex justify-between items-start gap-1 min-h-[36px]">
          <span
            className={`leading-tight ${priceRange.isRange ? "text-[11px]" : "text-sm"} ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`
            }>
            
            {priceRange.isRange ?
            `₱${priceRange.min.toFixed(0)} - ₱${priceRange.max.toFixed(0)}` :
            `PHP ${priceRange.min.toFixed(2)}`}
          </span>
          <span
            className={`text-xs whitespace-nowrap flex-shrink-0 ${displayStock === 0 ? "text-red-400" : theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
            
            {displayStock} left
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(product);
          }}
          className="w-full mt-2 py-2 text-xs text-white rounded-lg border hover:opacity-90 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
          style={{
            background: "#BAE4CB",
            borderColor: "rgba(9, 160, 70, 1)",
            boxShadow: "0 2px 2px rgba(0, 0, 0, 0.25)"
          }}>
          
          Add to Cart
        </button>
      </div>
    </div>);

});

export default ProductCard;