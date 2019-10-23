const Alexa = require('ask-sdk-core');

const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
var s3Attributes = {};

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        let speakOutput = 'Herzlich Willkommen beim Beer Counter. Wie kann ich helfen?';
        let repromptOutput = 'Kann ich etwas für dich tun? Ich kann Bier zählen.';
        
        const attributesManager = handlerInput.attributesManager;
        s3Attributes = await attributesManager.getPersistentAttributes() || {};
      
        if(s3Attributes.hasOwnProperty("firstBeer")){
            //reset Counter 24hours after the first Ber
            if (s3Attributes.firstBeer + (24 * 60 * 60 * 1000) < Date.now()) {
                s3Attributes.firstBeer = -1;
                s3Attributes.beers = 0;
                attributesManager.setPersistentAttributes(s3Attributes);
                await attributesManager.savePersistentAttributes(); 	
            }
        }
        if(s3Attributes.hasOwnProperty("beers") && s3Attributes.beers > 0){
            speakOutput += ` Ich habe bereits ${s3Attributes.beers} Bier für dich gezählt.`
            repromptOutput += ` Ich habe bereits ${s3Attributes.beers} Bier für dich gezählt.`
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const AddBeerHandler = {
    canHandle(handlerInput){
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
                    && handlerInput.requestEnvelope.request.intent.name === 'AddBeer';
    },  
    
    async handle(handlerInput, error){
        let beers = handlerInput.requestEnvelope.request.intent.slots.Anzahl.value;
        
        let output = `Ich zähle ${beers} Bier.`;
        
        const attributesManager = handlerInput.attributesManager;

       
        if(s3Attributes.hasOwnProperty("beers") && s3Attributes.beers > 0){
            s3Attributes.beers = parseInt(s3Attributes.beers) + parseInt(beers);
            if(s3Attributes.hasOwnProperty("firstBeer") && s3Attributes.firstBeer !== -1){
                s3Attributes.firstBeer = Date.now();
            }
            if(s3Attributes.beers > 1){
                output += ` Ich habe bereits ${beers} Bier für dich gezählt`;
            }
        }

        attributesManager.setPersistentAttributes(s3Attributes);
        await attributesManager.savePersistentAttributes();

        
        return handlerInput.responseBuilder.speak(output).getResponse();
    }
    
};

const GetBeerNumberHandler = {
  canHandle(handlerInput){
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
                    && handlerInput.requestEnvelope.request.intent.name === 'GetBeerNumber';
    },
    handle(handlerInput, error){
        let speakOutput;
        if(s3Attributes.hasOwnProperty("beers")){
            if(s3Attributes.beers > 0){
                speakOutput = `Ich habe ${s3Attributes.beers} Bier für dich gezählt. `;
            }else{
                speakOutput = `Ich habe noch kein Bier für dich gezählt. Füge doch eins hinzu`;
            }
        }else{
            speakOutput = `Ich habe keine gespeicherten Daten gefunden`;
        }
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Du kannst mit mir zählen, wie viel Bier du getrunken hast.';
        const repromptOutput = 'Frage nach, wie viele Bier ich bereits gezählt habe, oder füge neue Bier hinzu.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Bis Bald!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Ich habe leider nicht verstanden was ich tun soll. Probiere es doch nocheinmal.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};



// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .withPersistenceAdapter(
        new persistenceAdapter.S3PersistenceAdapter({bucketName:process.env.S3_PERSISTENCE_BUCKET})
    )
    .addRequestHandlers(
        LaunchRequestHandler,
        AddBeerHandler,
        GetBeerNumberHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();
    
    
    
