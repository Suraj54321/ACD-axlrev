const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config()
const twilio = require('twilio');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();

/**Cors configuration*/
app.use(cors('*'));

/**Body parser configuration*/
app.use(bodyParser.json());

// const server = http.createServer(app);
// const io = socketIo(server);

app.get('/',(req,res)=>{
    res.send("Hello World")
});

const accountSid = process.env.TWILIO_APP_SID; // Replace with your Account SID
const authToken = process.env.TWILIO_AUTH_TOKEN; // Replace with your Auth Token
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRECT;

const client = twilio(accountSid, authToken);

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const agents = [
    { id: 1, name: 'Agent 1', phone: '+919875109680' ,status:'busy'},
    { id: 2, name: 'Agent 2', phone: '+918707612763' ,status:'free'},
    { id: 3, name: 'Agent 3', phone: '+919510468308' ,status:'free'}
];

let currentAgentIndex = 0;

app.use(
    "/socket.io/socket.io.js",
    express.static(
      path.join(__dirname, "node_modules/socket.io/client-dist/socket.io.js"),
    ),
  );

app.get('/login',(req,res)=>{
        res.render('login');
})

app.post('/login',(req,res)=>{
    const { agentId } = req.body;
    const agent = agents.find(a => a.id === parseInt(agentId, 10));

    if (agent) {
        const identity = `agent-${agent.id}`;
        const token = new twilio.jwt.AccessToken(accountSid, apiKeySid, apiKeySecret, { identity });

        const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
            outgoingApplicationSid: process.env.TWILIO_TWIML_APPLICATION_SID,
            incomingAllow: true,
        });

        token.addGrant(voiceGrant);
        res.send({ token: token.toJwt(), agent })
        // res.render('login',{ token: token.toJwt(), agent });
    } else {
        res.render('login');
        // res.status(404).send('Agent not found');
    }
})

app.get('/agent',(req,res)=>{
    res.render('agent');
})

app.post('/token', (req, res) => {
    const { identity } = req.body;
    const token = new twilio.jwt.AccessToken(accountSid, apiKeySid, apiKeySecret, { identity });

    const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
        outgoingApplicationSid: process.env.TWILIO_TWIML_APPLICATION_SID,
        incomingAllow: true,
    });

    token.addGrant(voiceGrant);

    res.send({ token: token.toJwt() });
});

app.post('/incoming-call', (req, res) => {
    console.log("hello 1")
    handleCall(res, currentAgentIndex);
});

function handleCall(res, agentIndex) {
    const twiml = new twilio.twiml.VoiceResponse();

    const availableAgent = agents.find(agent => agent.status === 'free');

    if(availableAgent){
        console.log(availableAgent,agentIndex)
        const dial = twiml.dial({
            action: `/handle-disconnect?agentIndex=${agentIndex}`,
            timeout: 10,
        });
        dial.number(availableAgent.phone)
        availableAgent.status = 'busy';
        // .client('agent');
    }else {
        twiml.say('All agents are currently busy. Please try again later.');
    }

    res.type('text/xml');
    res.send(twiml.toString());
}

app.post('/handle-disconnect', (req, res) => {
    const agentIndex = parseInt(req.query.agentIndex, 10);
    const nextAgentIndex = (agentIndex + 1) % agents.length;

    if (req.body.DialCallStatus === 'completed') {
        res.sendStatus(200);
    } else {
        handleCall(res, nextAgentIndex);
    }
});


app.listen(process.env.PORT,()=>{
    console.log(`app is running on port number ${process.env.PORT}`);
})
