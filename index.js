const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./urbancare-firebase-adminsdk.json");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.e0ce8kl.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const Middleware = (req, res, next) => {
  console.log("I am from middleware");
  next();
};

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access - No token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decodedUser = decodedUser;
    next();
  } catch (error) {
    return res
      .status(403)
      .send({ message: "Forbidden access - Invalid token" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("UrbanCareDB");
    const issuesCollection = db.collection("issues");
    const contributionsCollection = db.collection("contributions");

    app.post("/issues", verifyToken, async (req, res) => {
      const newIssue = req.body;
      const decodedEmail = req.decodedUser.email;

      if (newIssue.email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden - Email mismatch" });
      }

      const result = await issuesCollection.insertOne(newIssue);
      res.send(result);
    });

    app.get("/all-issues", async (req, res) => {
      const result = await issuesCollection.find().toArray();
      res.send(result);
    });

    app.get("/issues", verifyToken, async (req, res) => {
      const decodedEmail = req.decodedUser.email;
      const email = req.query.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { email: email };
      const result = await issuesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/issues/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const query = { _id: new ObjectId(id) };
        const result = await issuesCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "Issue not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });

    app.put("/issues/:id", async (req, res) => {
      const id = req.params.id;
      const updatedIssue = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          ...updatedIssue,
        },
      };
      const options = {};
      const result = await issuesCollection.updateOne(query, update, options);
      res.send(result);
    });

    app.delete("/issues/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await issuesCollection.deleteOne(query);
      res.send(result);
    });

        app.get("/recent-issues", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = issuesCollection.find(query).sort({ date: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });


    // Contributions related Api's
    app.get("/contributions", async (req, res) => {
      const query = {};
      if (req.query.issueId) {
        query.issueId = req.query.issueId;
      }
      if (req.query.email) {
        query.email = req.query.email;
      }
      const result = await contributionsCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("UrbanCare Server is running");
});

app.listen(port, () => {
  console.log(`UrbanCare Server is running on port ${port}`);
});
