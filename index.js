const Alexa = require('ask-sdk-core');

const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
var s3Attributes = {};
var dataLoaded = false;

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        let speakOutput = 'Herzlich Willkommen beim Beer Counter. Wie kann ich helfen?';
        let repromptOutput = 'Kann ich etwas für dich tun? Ich kann Bier zählen.';

        const attributesManager = handlerInput.attributesManager;
        
        if (!dataLoaded) {
            await LoadAndCheckReset(attributesManager);
        }
        if(s3Attributes.hasOwnProperty("groupMode") && s3Attributes.groupMode && s3Attributes.groupSize > 1){
            speakOutput += ` Der Gruppenmodus ist aktiv. Ich habe bereits ${s3Attributes.beers} für die Gruppe gezählt. Jeder hat bereits ${s3Attributes.beers / s3Attributes.groupSize} Bier getrunken.`;
        }else{
            if (s3Attributes.hasOwnProperty("beers") && s3Attributes.beers > 0) {
                speakOutput += ` Ich habe bereits ${s3Attributes.beers} Bier gezählt.`
                repromptOutput += ` Ich habe bereits ${s3Attributes.beers} Bier gezählt.`
            }
        }

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

async function LoadAndCheckReset(attributesManager) {
    s3Attributes = await attributesManager.getPersistentAttributes() || {"beers":0, "firstBeer": -1, "groupMode": false, "groupSize": 0};
    dataLoaded = true;
    if (s3Attributes.hasOwnProperty("firstBeer")) {
        //reset Counter 24hours after the first Beer
        //firstBeer = -1 => reseted
        if (s3Attributes.firstBeer !== -1 && s3Attributes.firstBeer + (24 * 60 * 60 * 1000) < Date.now()) {
            s3Attributes.firstBeer = -1;
            s3Attributes.beers = 0;
            attributesManager.setPersistentAttributes(s3Attributes);
            await attributesManager.savePersistentAttributes();
        }
    }else{
        s3Attributes = {"beers":0, "firstBeer":-1};
    }
}

const AddBeerHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'AddBeer';
    },

    async handle(handlerInput, error) {
        let beers = handlerInput.requestEnvelope.request.intent.slots.Anzahl.value;

        let output = `Ich zähle ${beers} Bier`;

        const attributesManager = handlerInput.attributesManager;
        if (!dataLoaded) {
            await LoadAndCheckReset(attributesManager);
        }

        let group = s3Attributes.hasOwnProperty("groupMode") && s3Attributes.groupMode && s3Attributes.groupSize > 1;
        if(group){
              output += " für eure Gruppe.";
              beers *= s3Attributes.groupSize;
        }else{
            output += "."
        }
        if (s3Attributes.hasOwnProperty("beers")) {
            s3Attributes.beers = parseInt(s3Attributes.beers) + parseInt(beers);
            if (s3Attributes.hasOwnProperty("firstBeer") && (typeof(s3Attributes.firstBeer) === "undefined" || parseInt(s3Attributes.firstBeer) === -1)) {
                s3Attributes.firstBeer = Date.now();
            }
            if (s3Attributes.beers > 1) {
                if(group){
                    output += ` Ich habe bereits ${s3Attributes.beers} Bier für euch gezählt. Jeder hat ${s3Attributes.beers / s3Attributes.groupSize} Bier getrunken.`;
                }else{
                    output += ` Ich habe bereits ${s3Attributes.beers} Bier gezählt`;
                }
            }
        }

        attributesManager.setPersistentAttributes(s3Attributes);
        await attributesManager.savePersistentAttributes();


        return handlerInput.responseBuilder.speak(output).getResponse();
    }

};

const GetBeerNumberHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'GetBeerNumber';
    },
    async handle(handlerInput, error) {
        let speakOutput;
        if (!dataLoaded) {
            const attributesManager = handlerInput.attributesManager;
            await LoadAndCheckReset(attributesManager);
        }
        if (s3Attributes.hasOwnProperty("beers")) {
            if (s3Attributes.beers > 0) {
                speakOutput = `Ich habe ${s3Attributes.beers} Bier gezählt. `;
            } else {
                speakOutput = `Ich habe noch kein Bier gezählt. Füge doch eins hinzu`;
            }
        } else {
            speakOutput = `Ich habe keine gespeicherten Daten gefunden`;
        }
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

const ResetBeersHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'ResetBeersIntent';
    },
    async handle(handlerInput, error) {
        let speakOutput = "Dein BeerCounter wird zurückgesetzt";
        const attributesManager = handlerInput.attributesManager;
        if (!dataLoaded) {
            await LoadAndCheckReset(attributesManager);
        }
        //Method to reset data?
        if (s3Attributes.hasOwnProperty("beers")) {
            s3Attributes.beers = 0;
            s3Attributes.firstBeer = -1;
        }
        await attributesManager.savePersistentAttributes(s3Attributes);
        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

const EnterGroupModeHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'EnterGroupMode';
    },
    async handle(handlerInput, error) {
        let groupSize = handlerInput.requestEnvelope.request.intent.slots.GroupSize.value;
        let speakOutput = "Gruppenmodus bereits gestartet";
        
        const attributesManager = handlerInput.attributesManager;
        if (!dataLoaded) {
            await LoadAndCheckReset(attributesManager);
        }
        if (s3Attributes.hasOwnProperty("groupMode")) {
            if(!s3Attributes.groupMode){
                speakOutput = "Gruppenmodus mit " + groupSize + " Personen gestartet";
                s3Attributes.beers = 0;
                s3Attributes.firstBeer = -1;
                s3Attributes.groupMode = true;
                s3Attributes.groupSize = groupSize;
            }
        }else{
            s3Attributes.groupMode = false;
            s3Attributes.groupSize = 0;
        }
        attributesManager.setPersistentAttributes(s3Attributes);
        await attributesManager.savePersistentAttributes();

        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

const ExitGroupModeHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            handlerInput.requestEnvelope.request.intent.name === 'ExitGroupMode';
    },
    async handle(handlerInput, error) {
        let speakOutput = "Gruppenmodus ist nicht aktiv. ";
        
        const attributesManager = handlerInput.attributesManager;
        if (!dataLoaded) {
            await LoadAndCheckReset(attributesManager);
        }
        if (s3Attributes.hasOwnProperty("groupMode")) {
            if(s3Attributes.groupMode){
                speakOutput = "Gruppenmodus wird beendet.";
                s3Attributes.beers = 0;
                s3Attributes.firstBeer = -1;
                s3Attributes.groupMode = false;
                s3Attributes.groupSize = 0;
            }
        }else{
            s3Attributes.groupMode = false;
            s3Attributes.groupSize = 0;
        }
        attributesManager.setPersistentAttributes(s3Attributes);
        await attributesManager.savePersistentAttributes();

        return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
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
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
            (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent' ||
                Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
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
        new persistenceAdapter.S3PersistenceAdapter({ bucketName: process.env.S3_PERSISTENCE_BUCKET })
    )
    .addRequestHandlers(
        LaunchRequestHandler,
        AddBeerHandler,
        GetBeerNumberHandler,
        ResetBeersHandler,
        EnterGroupModeHandler,
        ExitGroupModeHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();