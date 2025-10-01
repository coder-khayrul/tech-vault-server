require('dotenv').config()
const express = require('express');

const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { authenticateUser } = require('./middlewares/authenticateUser');
const app = express()
const Stripe = require("stripe");
const stripe = new Stripe(process.env.PAYMENT_KEY);

const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pvi1q6h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
        const reviewCollection = client.db("app_orbitdb").collection("reviews");
        const userCollection = client.db("app_orbitdb").collection("users");



        app.post("/reviews", async (req, res) => {
            const newReview = req.body;
            newReview.timestamp = new Date().toISOString();
            const result = await reviewCollection.insertOne(newReview)
            res.send(result)
        })
        app.get("/reviews/:id", async (req, res) => {
            const id = req.params.id;
            const query = { productId: id };
            const cursor = reviewCollection.find(query)
            const result = await cursor.toArray();
            res.send(result)
        })
        app.get("/products/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { ownerEmail: email };
            const cursor = productCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        app.patch("/products/report/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = {
                $set: {
                    reported: true,
                    reportTimestamp: new Date().toISOString(),
                },
            };

            const result = await productCollection.updateOne(filter, update);
            res.send(result)
        });

        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result)
        })
        app.post("/products", async (req, res) => {
            const newProduct = req.body;
            const result = await productCollection.insertOne(newProduct)
            res.send(result)
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
        app.put("/products/:id", async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateProduct = req.body;
            const updatedDoc = {
                $set: updateProduct
            }
            const result = await productCollection.updateOne(filter, updatedDoc, options)
            res.send(result)


        })
        app.delete("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })
        app.get("/tranding-products", async (req, res) => {

            const trandingProducts = await productCollection
                .find({})
                .sort({ upvotes: -1 })
                .limit(6)
                .toArray();

            res.json(trandingProducts);
        })
        app.get("/featured-products", async (req, res) => {

            const featuredProducts = await productCollection
                .find({})
                .sort({ timestamp: -1 })
                .limit(4)
                .toArray();

            res.json(featuredProducts);
        })

        app.patch("/products/:id", async (req, res) => {
            const id = req.params.id;
            const { userEmail } = req.body;

            const product = await productCollection.findOne({ _id: new ObjectId(id) });

            if (!product) return res.status(404).send({ message: "Product not found" });

            if (product.voters && product.voters.includes(userEmail)) {
                return res.status(400).send({ message: "User already voted" });
            }

            const updatedDoc = {
                $inc: { upvotes: 1 },
                $addToSet: { voters: userEmail }
            };

            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                updatedDoc
            );

            res.send(result);
        });


        //********Payment system**** */
        app.post('/api/payment', async (req, res) => {
            try {
                const { paymentMethodId, amount, userEmail } = req.body;

                // Create PaymentIntent
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    receipt_email: userEmail,
                    currency: 'usd',
                    payment_method: paymentMethodId,
                    automatic_payment_methods: {
                        enabled: true,
                        allow_redirects: 'never'
                    },
                    confirm: true

                });

                if (paymentIntent.status === 'succeeded') {
                    res.json({ success: true, clientSecret: paymentIntent.client_secret });
                    const newPayment = req.body;
                    const result = await userCollection.insertOne(newPayment)
                    res.send(result)
                } else {
                    res.json({ success: false, error: 'Payment failed' });
                }
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });

        app.get("/api/user/:email", async (req, res) => {
            try {
                const user = await userCollection.findOne({ userEmail: req.params.email });
                if (!user) return res.status(404).json({ error: "User not found" });
                res.json(user);

            } catch (error) {
                res.status(500).json({ error: error.message });
            }
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