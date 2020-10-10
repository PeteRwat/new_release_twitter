const fs = require('fs');
const https = require('https');
var AWS = require('aws-sdk');

function httpsRequest(account, searchTerms) {
    console.log("in https request")
    var searchQuery = searchTerms !== "" ? encodeURI(searchTerms.join(" ")).replace(/%22/g, '"') : searchTerms

    var options = {
        host: 'api.twitter.com',
        path: `/1.1/search/tweets.json?q=from%3A${account}%20${searchQuery}`,
        headers: {
            'Authorization' : 'Bearer AAAAAAAAAAAAAAAAAAAAACjFIAEAAAAAZKf1zr4hTbo%2B5icNycZ4lidmM2Q%3DXCxsI5aGDtj1x0kAqluqZFaNvomr3xcfYQyv7OML2E8Nz9Xhci'
          }
      };

    return new Promise(function(resolve, reject) {
        console.log("in https request promise")
        var req = https.request(options, function(res) {
            // reject on bad status
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }
            // cumulate data
            var body = [];
            res.on('data', function(chunk) {
                body.push(chunk);
            });
            // resolve on end
            res.on('end', function() {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                } catch(e) {
                    reject(e);
                }
                resolve(body);
            });
        });
        // reject on request error
        req.on('error', function(err) {
            // This is not a "Second reject", just a different sort of failure
            reject(err);
        });

        // IMPORTANT
        req.end();
    });
}

function getTweetsForAccount(statuses) {
    if(statuses.length === 0){
        return null
    }

    const tweets = statuses.map(status => {return {id: status.id_str, text: status.text}})
    
    const account = statuses[0].user.screen_name
    return {account, tweets}
}

function createEmailTextFromTweets(tweetsByAccountToIncludeInEmail) {
    var emailText = ""

    tweetsByAccountToIncludeInEmail.forEach(account => {
        if(account !== null){
            const tweetUrlTemplate = `https://twitter.com/${account.account}/status/ID`
        
            emailText += account.account
            emailText += "\n\n"
    
            account.tweets.forEach(tweet => {
                const spacer = "  "
    
                emailText += spacer + tweetUrlTemplate.replace("ID", tweet.id)
                emailText += "\n"
                emailText += spacer + tweet.text.replace('\n', ``)
                emailText += "\n\n"
            })
            
            emailText += "\n"
        }
    })

    return emailText
}

function readSearchTerms(file){ 
    const searchTermsFile = fs.readFileSync(file).toString('utf8')
    const searchTerms = searchTermsFile.split('\n')
    
    if(searchTerms[0] === "KILL"){
        return ""
    }else{
        return searchTerms
    }
}

exports.handler = async (event, context) => {
    
    const accountsFile = fs.readFileSync('./accounts.txt').toString('utf8')

    console.log("account file ->", accountsFile)
    const accounts = accountsFile.split('\n')
    console.log("accounts ->", accounts)

    const searchTerms = readSearchTerms('./search-terms.txt')
    console.log("search terms -->", searchTerms)

    await Promise.all(accounts.map(account => {
        console.log("making requests")
        return httpsRequest(account, searchTerms)}))
            .then(responses => {
                console.log("processing responses")
                const tweetsToIncludeInEmail = responses.map(response => getTweetsForAccount(response.statuses))
                const emailBody = createEmailTextFromTweets(tweetsToIncludeInEmail)

                console.log("email body -->", emailBody)

                if(emailBody !== ""){
                    var params = {
                        Destination: {
                            ToAddresses: ['peter.rwatschew.p123@gmail.com']
                        },
                        Message: { 
                        Body: { 
                            Text: {
                            Charset: "UTF-8",
                            Data: emailBody
                            }
                        },
                        Subject: {
                            Charset: 'UTF-8',
                            Data: 'Test email'
                        }
                        },
                        Source: 'peter.rwatschew.p123@gmail.com', 
                    };
                    console.log("trying to sending email")
                    AWS.config.update({region: 'eu-west-1'});
                    var sendPromise = new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

                    sendPromise.then(
                        function(data) {
                        console.log(data.MessageId);
                        }).catch(
                        function(err) {
                        console.error(err, err.stack);
                        });
                }
                
            })


            var params = {
                Destination: {
                    ToAddresses: ['peter.rwatschew.p123@gmail.com']
                },
                Message: { 
                Body: { 
                    Text: {
                    Charset: "UTF-8",
                    Data: "test"
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: 'Test email'
                }
                },
                Source: 'peter.rwatschew.p123@gmail.com', 
            };
            console.log("trying to sending email")
            AWS.config.update({region: 'eu-west-1'});
            var sendPromise = new AWS.SES({apiVersion: '2010-12-01'}).sendEmail(params).promise();

            await sendPromise.then(
                function(data) {
                console.log(data.MessageId);
                }).catch(
                function(err) {
                console.error(err, err.stack);
                });

    return "ran lambda"
}
