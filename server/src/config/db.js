import dns from "dns";
import mongoose from "mongoose";

// Windows' default DNS resolver sometimes can't resolve the SRV/TXT records a
// mongodb+srv:// URI depends on (ENOTFOUND on _mongodb._tcp...), typically
// because a VPN or the router's DNS doesn't relay those record types even
// though plain A-record lookups work fine — `nslookup` (which uses Windows'
// own resolver, not Node's) can succeed against the exact same hostname that
// Node's dns module fails on. Render's containers resolve the same records
// without issue, so this only forces a known-good DNS server in local dev,
// which is where this has actually been observed to fail.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
