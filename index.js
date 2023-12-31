const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const cors = require("cors");
const stripe = require("stripe")('sk_test_51NIqtxGhozHSO42RWI43bsww1Owgt506uL9ahPsFEh6eQmWXfgSCohKlUGHkFw6k4fMI5TgddmnOXijRYcRBYVCq00WgUjpAWA');
const port = process.env.PORT || 5000;
require("dotenv").config();

app.use(cors());
app.use(express.json());
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  if(!authorization){
    return res.status(401).send({error : true , message : 'unauthorized access'});
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token,'22bf1e295937411ad2677dc6fe8e909049051660d238802ccb85730904712cd1ce6cb84e74fe698fa843b4b6e6339b2f9b0cccbd88e1c592e70f92bf21954fbb ',(err, decoded) =>{
    if(err){
      return res.status(401).send({error : true , message :  'unauthorized access'});
    }
    req.decoded=decoded;
    next();
  })
}

app.get("/", (req, res) => {
  res.send("summer school is running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ot7ey7w.mongodb.net/?retryWrites=true&w=majority`;

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
    await client.connect();
    const usersCollection = client.db("summerCamp").collection("users");
    const classCollection = client.db("summerCamp").collection("classes");
    const teacherCollection = client.db("summerCamp").collection("teachers");
    const cartCollection = client.db("summerCamp").collection("carts");
    const paymentCollection = client.db("summerCamp").collection("payments");

    app.post("/payments",verifyJWT, async (req, res) => {
      const payment = req.body
      const result = await paymentCollection.insertOne(payment);
      const query = {_id: { $in: payment.cartItems.map(id => new ObjectId(id))}}
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({result, deleteResult});
    })

    app.post('/jwt', (req,res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{expiresIn :'1h'} )
      res.send({ token });
    })

    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email};
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin') {
        return res.status(403).send({error:true, message:'forbidden message'})
      }
      next();
    }

    app.get("/users",verifyJWT,verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      console.log(existingUser);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });
    app.post("/classes",verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    })
    app.get("/teachers", async (req, res) => {
      const result = await teacherCollection.find().toArray();
      res.send(result);
    });
    app.get("/carts",verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail) {
        return  res.status(403).send({error : true , message :  'forbidden access'});
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/users/admin/:email',verifyJWT, async (req, res) =>{
      const email = req.params.email;
      if(req.decoded.email !== email){
        res.send({ admin : false });
      }
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin'}
      res.send(result);
    })

    app.post("/carts", async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/classes/:id",verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });
    app.post('/create-payment-intent',verifyJWT, async (req,res) => {
      const { price } = req.body
      const amount = price * 100
      console.log(price, amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'USD',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
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

app.listen(port, (req, res) => {
  console.log(`summer school is listening on port :${port}`);
});
