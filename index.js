const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const req = require("express/lib/request");
const port = process.env.PORT || 5100;

app.use(cors());
app.use(express.json());

//dreamRent
//x9WMOaAWPTew6hJ3

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z4uro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    const apartmentsCollection = client
      .db("DreamRent")
      .collection("apartments");
    const userCollection = client.db("DreamRent").collection("users");
    const paymentCollection = client.db("DreamRent").collection("payments");
    const couponCollection = client.db("DreamRent").collection("couponCode");
    const agreementCollection = client.db("DreamRent").collection("agreements");
    const announcementCollection = client
      .db("DreamRent")
      .collection("announcements");

    //Auth Related Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //verify token middleware

    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // verify Token
      jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbiddend Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbiddend Access" });
      }
      next();
    };

    //Users related API

    // app.get("/usersProfile/:email", async (req, res) => {
    //   const email = req.query.email;
    //   console.log("Received email in backend:", email);
    //   // const query = { email: email };
    //   if (!email) {
    //     return res.status(400).send({ message: "user & email not found" });
    //   }
    //   const user = await userCollection.findOne({ email });
    //   if (!user) {
    //     return res.status(404).send({ message: "user not found" });
    //   }
    //   res.send(user);
    // });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //  get user Role api

    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbiddend Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      let member = false;
      if (user) {
        admin = user?.role === "admin";
        member = user?.role === "member";
      }

      res.send({ admin, member });
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      // console.log(newUser);
      const query = { email: newUser.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.patch(
      "/users/member/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "member",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/apartments", async (req, res) => {
      const search = req.query.search || "";
      const min_rent = parseInt(req.query.min_rent) || 0;
      const max_rent = parseInt(req.query.max_rent) || 1000000;
      let query = {
        location: { $regex: search, $options: "i" },
        "rentRange.min_rent": { $gte: min_rent },
        "rentRange.max_rent": { $lte: max_rent },
      };
      const result = await apartmentsCollection.find(query).toArray();
      res.send(result);
    });

    //Agreements Related Api

    // get data by email
    app.get("/agreements", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      // if (req.params.userEmail !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbeddend access" });
      // }
      const result = await agreementCollection.find(query).toArray();
      res.send(result);
    });

    // All get data

    app.get("/allAgreements", async (req, res) => {
      const result = await agreementCollection.find().toArray();
      res.send(result);
    });

    app.post("/agreement", async (req, res) => {
      const newAgreement = req.body;
      const result = await agreementCollection.insertOne(newAgreement);
      res.send(result);
    });

    //agreement Patch

    app.patch("/agreements/:id", async (req, res) => {
      const { id } = req.params;
      const { action } = req.body;
      const filter = { _id: new ObjectId(id) };
      const agreement = await agreementCollection.findOne(filter);
      if (!agreement) {
        return res.status(404).send({ message: "Agreement not Found" });
      }
      const actionUpdate = { status: "checked" };
      if (action === "accept") {
        actionUpdate.role = "member";
      } else if (action === "reject") {
        actionUpdate.role = "user";
      }
      const updatedDoc = {
        $set: actionUpdate,
      };
      const result = await agreementCollection.updateOne(filter, updatedDoc);
      const userEmail = agreement.userEmail;
      const userFilter = { email: userEmail };
      console.log("user update", userFilter);
      const userUpdate = {
        $set: { role: action === "accept" ? "member" : "user" },
      };
      const userResult = await userCollection.updateOne(userFilter, userUpdate);
      console.log(userResult);
      res.send({ result, userResult });
    });

    app.delete("/requestCard/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await agreementCollection.deleteOne(query);
      res.send(result);
    });

    //Announcement API
    app.get("/announcements", async (req, res) => {
      const query = req.body;
      const result = await announcementCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/announcements", async (req, res) => {
      const newAnnounce = req.body;
      const result = await announcementCollection.insertOne(newAnnounce);
      res.send(result);
    });

    // Payment Related API

    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const agreementPayment = req.body;
      console.log(agreementPayment);
      const result = await paymentCollection.insertOne(agreementPayment);
      res.send(result);
    });

    //Coupon code api check when apartment renter pay to rent then do the getcode button then fire this API

    app.post("/couponCode", async (req, res) => {
      const { couponCode } = req.body;
      const query = { code: couponCode };
      const couponResult = await couponCollection.findOne(query);
      if (!couponResult) {
        return res.status(404).send({ message: "Invalid Coupon Code" });
      }
      const currentDate = new Date();
      if (currentDate > couponResult.validDate) {
        return res.status(400).send({ message: "Coupon has Expired!" });
      }
      res.send({
        discount: couponResult.discount,
      });
    });

    // Get Coupon Api
    app.get("/get-all-coupons", async (req, res) => {
      const query = req.body;
      const result = await couponCollection.find(query).toArray();
      res.send(result);
    });
    // coupon Create Api by Admin

    app.post("/createCoupon", async (req, res) => {
      const couponQuery = req.body;
      const result = await couponCollection.insertOne(couponQuery);
      res.send(result);
    });
    // Update Coupon ApI
    app.patch("/updateCoupon/:id", async (req, res) => {
      const coupon = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          code: coupon.code,
          discount: coupon.discount,
          apartmentNo: coupon.apartmentNo,
          validDate: coupon.validDate,
          description: coupon.description,
        },
      };
      const result = await couponCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //Coupon Delete Api
    app.delete("/deleteCoupon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await couponCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
