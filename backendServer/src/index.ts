import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import userRoutes from "./routes/userRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import fleetRoutes from "./routes/fleetRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
// import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

//Router imports

//Configuring environment variables
dotenv.config();
const app = express();

// Configure allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGINS,
  "https://rosteringsystemfrontend.vercel.app",
  "https://www.rosteringsystemfrontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
].flatMap(o => (o ? o.split(",").map(s => s.trim()) : []))
  .filter((url): url is string => Boolean(url));

app.use(
  cors({
    origin: true, // Specifically allows reflecting origin which is robust for credentials
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    optionsSuccessStatus: 200
  }),
);

app.use(express.json());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" } // Helps with some cross-origin redirect/popups
  })
);
app.use(morgan("common"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const port = process.env.PORT || 3000;

/* Routes */
app.get("/", (req, res) => {
  res.send("---This is home route---");
});

app.use("/users", userRoutes);
app.use("/customers", customerRoutes);
app.use("/fleet", fleetRoutes);
app.use("/bookings", bookingRoutes);

// //Error handling middlewares should come after routes
// app.use(notFound);
// app.use(errorHandler);

//Server setup
app.listen(port, () => {
  console.log(`Server is running on port - ${port}`);
});
