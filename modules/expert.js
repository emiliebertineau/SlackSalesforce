var nforce = require('nforce'),
    org = require('./auth').org,

    EXPERT_TOKEN = process.env.SLACK_EXPERT_TOKEN;
    console.log('EXPERT_TOKEN: ' + EXPERT_TOKEN);

function execute(req, res) {

    if (req.body.token != EXPERT_TOKEN) {
        res.send("Le token n'est pas valide.");
        return;
    }

    var params = req.body.text;
    var slackUserId = req.body.user_id;
    var slackUserName = req.body.user_name;

    console.log('params: ' + params);
    console.log('slackUserId: ' + slackUserId);
    console.log('slackUserName: ' + slackUserName);

    if(params == '' || params == 'list') {
        var q = "SELECT Id, Name, Slack_User_ID__c, Achievement__c, Slack_User_Name__c, CreatedDate FROM Expert_Achievement__c WHERE Slack_User_ID__c = '" + slackUserId + "'";
        org.query({query: q}, function(err, resp) {
            if (err) {
                console.error(err);
                res.send("Une erreur s'est produite.");
                return;
            }
            if (resp.records && resp.records.length>0) {
                var expertAchievements = resp.records;
                var attachments = [];
                expertAchievements.forEach(function(expertAchievement) {     
                    var fields = [];
                    var dateSansHeure = expertAchievement.get("CreatedDate").split("T");
                    var dateConcassee = dateSansHeure[0].split("-");
                    var date = dateConcassee[2] + '/' + dateConcassee[1] + '/' + dateConcassee[0];
                    fields.push({title: "Achievement - " + date, value: expertAchievement.get("Achievement__c"), short:false});
                    attachments.push({color: "#FCB95B", fields: fields});
                });
                res.json({
                    response_type: "in_channel",
                    text: "Achievements de " + slackUserName,
                    attachments: attachments
                });
            } else {
                res.send("Aucun record n'a été trouvé.");
            }
        });
    } else if(params == 'help') {
        var attachments = [];
        var fields = [];
        fields.push({value: '/expert : renvoie la liste de vos Achievements.', short:false});
        fields.push({value: '/expert list : renvoie la liste de vos Achievements.', short:false});
        fields.push({value: '/expert xxxxx : créé un Achievement avec pour text xxxxx.', short:false});
        attachments.push({color: "#FCB95B", fields: fields});
        res.json({
            response_type: "in_channel",
            text: "Comment utiliser le /expert:",
            attachments: attachments
        });
    } else {
        var c = nforce.createSObject('Expert_Achievement__c');
        var achievement = params;
        c.set('Slack_User_ID__c', slackUserId);
        c.set('Slack_User_Name__c', slackUserName);
        c.set('Achievement__c', achievement);

        org.insert({ sobject: c}, function(err, resp) {
            if (err) {
                console.error(err);
                res.send("Une erreur s'est produite lors de la création de votre Achievement.");
            } else {
                var fields = [];
                fields.push({title: "Achievement", value: params, short:false});
                var message = {
                    response_type: "in_channel",
                    text: "Un nouvel Achievement a été créé:",
                    attachments: [
                        {color: "#F2CF5B", fields: fields}
                    ]
                };
                res.json(message);
            }
        });
    }
}

exports.execute = execute;