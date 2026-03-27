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
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const port = process.env.PORT || 3000;
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL, // <-- Put your Production Frontend URL here in Railway
      "https://rosteringsystem-crm-production.up.railway.app",
      "http://localhost:3000",
      "https://rosteringsystemfrontend.vercel.app"
    ].filter((url): url is string => Boolean(url)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

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
