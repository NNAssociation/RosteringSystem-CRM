import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
// import userRoutes from "./routes/userRoutes.js";
// import customerRoutes from "./routes/customerRoutes.js";
// import jobRoutes from "./routes/jobRoutes.js";
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
app.use(cors());

/* Routes */
app.get("/", (req, res) => {
  res.send("--This is home route--");
});

//Server setup
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port - ${port}`);
});
