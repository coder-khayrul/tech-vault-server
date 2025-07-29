require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { authenticateUser } = require('./middlewares/authenticateUser');
const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pvi1q6h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // await client.connect();
        const productCollection = client.db("app_orbitdb").collection("products");
        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result)
        })
        app.post("/products", async (req, res) => {
            console.log(req.body)
            const newProduct = req.body;
            const result = await productCollection.insertOne(newProduct)
            res.send(result)
        })
        app.get("/featured-products", async (req, res) => {

            const featuredProducts = await productCollection
                .find({})
                .sort({ timestamp: -1 }) 
                .limit(4)
                .toArray();

            res.json(featuredProducts);
        })
        app.get("/products", async (req, res) => {
            const search = req.query.search;
            const query = {};

            if (search) {
                query.productName = { $regex: search, $options: "i" };
            }
            const cursor = productCollection.find(query)
            const result = await cursor.toArray();
            res.send(result)
        })


        app.patch("/products/:id", async (req, res) => {
            const id = req.params.id;
            const { userEmail } = req.body; // get email from frontend

            const product = await productCollection.findOne({ _id: new ObjectId(id) });

            if (!product) return res.status(404).send({ message: "Product not found" });

            if (product.voters && product.voters.includes(userEmail)) {
                return res.status(400).send({ message: "User already voted" });
            }

            const updatedDoc = {
                $inc: { upvotes: 1 },
                $addToSet: { voters: userEmail } // prevent duplicates
            };

            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                updatedDoc
            );

            res.send(result);
        });



        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);





app.get("/", (req, res) => {
    res.send("WELCOME To APP ORBIT SERVER")
})

app.listen(port, () => {
    console.log("This Server is running on", port);
})