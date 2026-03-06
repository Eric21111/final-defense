import { useNavigation } from "@react-navigation/native";
import { Image, StyleSheet, Text, View } from "react-native";

export default function About() {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Text style={styles.spacer}>
        The Create Your Style Tracking App is a simple and efficient system
        designed to help our thrift and clothing shop manage daily reports,
        inventory concerns, and shop updates in one organized place. It
        streamlines how staff record issues, track stock movement, and
        communicate important shop activities, making operations faster,
        clearer, and more reliable. With this app,
      </Text>
      <Text style={styles.spacer2}>
        we aim to improve coordination, reduce errors, and maintain smooth store
        management—all while supporting the overall mission of delivering a
        better and more organized shopping experience for our customers.
      </Text>

      {/* Two Company Logos Side by Side */}
      <View style={styles.logoContainer}>
        <Image
          source={require("./(tabs)/iconz/AAAAAA.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Image
          source={require("./(tabs)/iconz/profile1.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6F2",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  spacer: {
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 20,
  },
  spacer2: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 20,
  },
  logoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    marginLeft: 30,
    marginRight: 30,
  },
  logo: {
    width: 150,
    height: 100,
  },
});
