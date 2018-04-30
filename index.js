'use strict';
//to doo alexa stuff
const Alexa = require('ask-sdk-core');
//to get content from rss feed
const Parser = require('rss-parser');
const request = require('request');
//for scraping content from web pages
const cheerio = require('cheerio');

//all strings and liks tored in config file, you probably need to create one using config.sample.js file
const config = require('./config.local');

/*
Intent Handlers
*/

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },

    handle(handlerInput) {
        console.log('in launch request');

        // get/set some of session attributes
        var attributes = handlerInput.attributesManager.getSessionAttributes();
        attributes.currentSession = 0;
        var item = attributes.items[attributes.currentSession];
        attributes.lastIntent = "LaunchRequest";
        handlerInput.attributesManager.setSessionAttributes(attributes);

        // genereate the speech output
        var speech = 'welcome to Prime Minister\'s Questions skill. ';
        var date = new Date(item.isoDate);
        speech += `last questions session was on <say-as interpret-as=\"date\">${dateFormat(date, "%Y%m%d")}</say-as>. `;
        speech += `Do you want to listen the questions of it?`;

        // return the response
        return handlerInput.responseBuilder
            .speak(speech)
            .withStandardCard('Welcome', item.title, config.strings.cardImgSmall, config.strings.cardImgLarge)
            .reprompt(speech)
            .getResponse();
    }
};

const YesIntent = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        var sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        switch (sessionAttributes.lastIntent) {
            case "LaunchRequest":
                sessionAttributes.lastIntent = "";
                return LastSessionDetails.handle(handlerInput);
                break;
            default:
                console.log("last asked not matched");
                resolve(handlerInput.responseBuilder.speak("Sorry. I don't know that!").getResponse())
                break;
        }
    },
};


const NoIntent = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent';
    },
    handle(handlerInput) {
        var sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        switch (sessionAttributes.lastAsked) {
            case "LaunchRequest":
                var speechOutput = randomString(config.strings.byePhrases);
                return handlerInput.responseBuilder.speak(speechOutput)
                    .getResponse();
                break;
            default:
                resolve(handlerInput.responseBuilder.speak("Sorry. I don't know that!").getResponse())
                break;
        }
    },
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = config.strings.HELP_SPEECH;
        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    }
};

const LastSessionDetails = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'LastSessionDetails';
    },
    handle(handlerInput) {
        return new Promise((resolve, reject) => {
            var sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
            var link = sessionAttributes.items[0].link;
            getQuestions(link, function (questions) {
                if (questions && questions.length) {
                    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
                    var speechOutput = "here is the list of questions from last session: ";
                    questions.forEach(element => {
                        speechOutput += element + ". "
                    });
                    console.log(speechOutput);
                    handlerInput.responseBuilder.speak(speechOutput);
                    console.log("speech added");
                    handlerInput.responseBuilder.withStandardCard('Last Session Details', sessionAttributes.items[0].title, config.strings.cardImgSmall, config.strings.cardImgLarge);
                    console.log("card added");
                    var response = handlerInput.responseBuilder.getResponse();
                    console.log("response created");
                    console.log(JSON.stringify(response, null, 2));
                    resolve(response);
                } else {
                    console.log('questions is NOT present')
                    resolve(handlerInput.responseBuilder.speak("I cant get the questions right now. please try again later. ")
                        .getResponse());
                }
            });
        });
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        console.log("in cancel or stop intent")
        return handlerInput.responseBuilder
            .speak(randomString(config.strings.byePhrases))
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        //any cleanup logic goes here
        return handlerInput.responseBuilder.getResponse();
    }
};


/*
Error Handler
*/

const ErrorHandler = {
    canHandle(handlerInput, error) {
        return error.name.startsWith('AskSdk');
    },
    handle(handlerInput, error) {
        console.log("in error handler");
        console.log(JSON.stringify(error, null, 2));
        return handlerInput.responseBuilder
            .speak('An error was encountered while handling your request. Try again later')
            .getResponse();
    }
}

/*
Interceptors
*/

const getRssInterceptor = {
    process(handlerInput) {
        console.log(`REQUEST++++${JSON.stringify(handlerInput, null, 2)}`);
        return new Promise((resolve, reject) => {
            var attributes = handlerInput.attributesManager.getSessionAttributes();
            if (!attributes.items) {
                console.log("Items is not present");
                getItems(200, function (items) {
                    attributes.items = items;
                    handlerInput.attributesManager.setSessionAttributes(attributes);
                    resolve();
                });
            } else {
                console.log("Items is present");
                resolve();
            }
        });
    },
};

const logResponseInterceptor = {
    process(handlerInput, response) {
        console.log('in logResponseInterceptor');
        console.log(JSON.stringify(handlerInput.responseBuilder.getResponse(), null, 2));
    },
};


/*
Some other methods
 */

//get random item from array tom make some responses more natural
function randomString(array) {
    //check that the given item is not a string, otherwise simply return the string
    var type = typeof array;
    if (type == "string") {
        log("the string literal in random phrase");
        return array;
    }

    var i = 0;
    if (array) { //array is not empty
        if (array.length) {
            i = Math.floor(Math.random() * array.length); //random i
            console.log("phrase is: " + array[i]);
            return (array[i]); //return random item from array
        }
    }
    return "";
}

//generate date string by pattern
function dateFormat(date, fstr, utc) {
    utc = utc ? 'getUTC' : 'get';
    return fstr.replace(/%[YmdHMS]/g, function (m) {
        switch (m) {
            case '%Y': return date[utc + 'FullYear'](); // no leading zeros required
            case '%m': m = 1 + date[utc + 'Month'](); break;
            case '%d': m = date[utc + 'Date'](); break;
            case '%H': m = date[utc + 'Hours'](); break;
            case '%M': m = date[utc + 'Minutes'](); break;
            case '%S': m = date[utc + 'Seconds'](); break;
            default: return m.slice(1); // unknown code, remove %
        }
        // add leading zero if required
        return ('0' + m).slice(-2);
    });
}

//get list of PMQs news posts from rss feed 
function getItems(count, callback) {
    let parser = new Parser();
    var list = [];

    parser.parseURL(config.strings.rss_feed_link + count, function (err, feed) {
        if (err) {
            callback(null);
            return;
        }
        console.log(feed.title);
        feed.items.forEach(item => {
            if (
                item.title.toLowerCase().indexOf("prime") > -1
                && item.title.toLowerCase().indexOf("questions") > -1
            ) {
                console.log(item.isoDate + ' ' + item.title);
                list.push(item);
            }
        });
        callback(list);
    });
}


//get list of questions by link to the news web page 
function getQuestions(link, callback) {
    var options = {
        url: link,
    }

    request(options, function (error, response, body) {
        if (error) {
            console.log("error");
            return callback(null);
        }

        if (response.statusCode !== 200) {
            console.log("error");
            return callback(null);
        } else {

            var $ = cheerio.load(body);
            var content = $('#ctl00_ctl00_FormContent_SiteSpecificPlaceholder_PageContent_ctlMainBody_wrapperDiv').children('div');

            var array = [];

            var isHeaderReached = false;
            content.children().each(function (i, elem) {
                if (isHeaderReached) {
                    if (this.name === 'p' && $(this).text().indexOf("asked") > -1) {
                        array.push($(this).text());
                    }

                } else {
                    if (this.name === 'h2' || this.name === 'h3') {
                        isHeaderReached = true;
                    }
                }
            });
            return callback(array);
        }

    })
}

//register all handlers and buildthe skill
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        YesIntent,
        NoIntent,
        LastSessionDetails
    )
    .addRequestInterceptors(getRssInterceptor)
    .addResponseInterceptors(logResponseInterceptor)
    .addErrorHandlers(ErrorHandler)
    .lambda();