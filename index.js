const fs = require('fs');
const https = require('https');

const bearerToken = "AAAAAAAAAAAAAAAAAAAAACjFIAEAAAAAZKf1zr4hTbo%2B5icNycZ4lidmM2Q%3DXCxsI5aGDtj1x0kAqluqZFaNvomr3xcfYQyv7OML2E8Nz9Xhci"

function httpsRequest(account, searchTerms) {
    
    var searchQuery = encodeURI(searchTerms.join(" ")).replace(/%22/g, '"')

    var options = {
        host: 'api.twitter.com',
        path: `/1.1/search/tweets.json?q=from%3A${account}%20${searchQuery}`,
        headers: {
            'Authorization' : 'Bearer AAAAAAAAAAAAAAAAAAAAACjFIAEAAAAAZKf1zr4hTbo%2B5icNycZ4lidmM2Q%3DXCxsI5aGDtj1x0kAqluqZFaNvomr3xcfYQyv7OML2E8Nz9Xhci'
          }
      };

    return new Promise(function(resolve, reject) {
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

const accountsFile = fs.readFileSync('./accounts.txt').toString('utf8')
const accounts = accountsFile.split('\n')

const searchTermsFile = fs.readFileSync('./search-terms.txt').toString('utf8')
const searchTerms = searchTermsFile.split('\n')


Promise.all(accounts.map(account => httpsRequest(account, searchTerms))).then(responses => {
    const tweetsToIncludeInEmail = responses.map(response => getTweetsForAccount(response.statuses))


    const emailBody = createEmailTextFromTweets(tweetsToIncludeInEmail)
    
    if(emailBody !== ""){
        var params = {
            Destination: {
                ToAddresses: ["recipientEmailAddress"]
            },
            Message: {
                Body: {
                    Text: { 
                        Data: emailBody
                    }   
                },
                Subject: { 
                    Data: "Test Email"    
                }
            },
            Source: "sourceEmailAddress"
        };
    
        // send email
    }
    
})

