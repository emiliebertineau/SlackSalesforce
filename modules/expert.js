var nforce = require('nforce'),
org = require('./auth').org,

EXPERT_TOKEN = process.env.SLACK_EXPERT_TOKEN;
console.log('EXPERT_TOKEN: ' + EXPERT_TOKEN);
EXPERT_DOMAIN = process.env.SLACK_EXPERT_DOMAIN;
console.log('EXPERT_DOMAIN: ' + EXPERT_DOMAIN);

var domains = EXPERT_DOMAIN.split('::');
var domainList = '';
domains.forEach(function(domain) {
    domainList += domain + ', '; 
});
domainList = domainList.slice(0, -1);

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

    if(params == 'list') {
        var q = "SELECT Id, Name, Slack_User_ID__c, Achievement__c, Slack_User_Name__c, CreatedDate, Nombre_Heure__c, Domaine_Expertise__c, Date_achievement__c " +
                "FROM Expert_Achievement__c " + 
                "WHERE Slack_User_ID__c = '" + slackUserId + "'";
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
                    var valeur = 'Domaine: ' + expertAchievement.get("Domaine_Expertise__c") + '\n' +
								 'Date de l\'achievement : '+expertAchievement.get("Date_achievement__c")+ '\n' +
                                 'Nombre d\'heure: ' + expertAchievement.get("Nombre_Heure__c") + '\n' +
                                 'Description: ' + expertAchievement.get("Achievement__c");
                    console.log('valeur: ' + valeur);
                    fields.push({title: "Achievement - " + date, value: valeur, short:false});
                    attachments.push({color: "#FCB95B", fields: fields});
                });
                res.json({
                    response_type: "ephemeral",
                    text: "Achievements de " + slackUserName,
                    attachments: attachments
                });
            } else {
                res.send("Aucun record n'a été trouvé.");
            }
        });
    } else if(params == '' || params == 'help') {
        var attachments = [];
        var fields = [];
        fields.push({value: '/expert1 : renvoie la liste de vos Achievements.', short:false});
        fields.push({value: '/expert1 list : renvoie la liste de vos Achievements.', short:false});
        fields.push({value: '/expert1 Domaine::Date de l\achievement(jj/mm/aaaa)::Nombre d\'heure::Description : créé un Achievement.', short:false});
        fields.push({value: 'Les domaines acceptés sont les suivant: ' + domainList, short:false});
        attachments.push({color: "#FCB95B", fields: fields});
        res.json({
            response_type: "ephemeral",
            text: "Comment utiliser le /expert:",
            attachments: attachments
        });
    } else {
        var c = nforce.createSObject('Expert_Achievement__c');
        var achievement = params.split("::");

        // On vérifie qu'il y a bien les 3 paramètres pour créer l'Achievement
        console.log('achievement.length: ' + achievement.length);
        if(achievement.length != 4) {
            res.send("Il n'y a pas le bon nombre d'arguments. Pour rappel la commande s'écrit ainsi : /expert DOMAINE::Date de l\achievement(jj/mm/aaaa)::TEMPS(de type number)::Achievement.");
            return;
        }

        // On vérifie que le Domaine rentré fait bien partie des Domaines accepté. 
        if(!EXPERT_DOMAIN.includes(achievement[0])) {
            res.send('Le Domaine rentré n\'est pas acceptable. Pour connaitre les Domaines acceptés tapez "/expert help"');
            return;
        }
		
		// DEBUT TRAITEMENT de la Date de l'achievement
		
		// Récupération de la date dans la cmd
		var dateCmd =achievement[1];
		// comptage du nombre de slash pour verifier le format
		var nbSlash = dateCmd.split("/").length;
		// comptage de la taille de la date pour verifier le format
		var	dateLength = dateCmd.length;	
		
		// envoi du message d'erreur si la date n'est pas au bon format
		if(dateLength !=10 || nbSlash !=3)
		{
			 res.send('La date saisie est incorrecte. Le format de date attendu est le suivant : jj/mm/aaaa');
			 return;
		}
		var dateSplit = dateCmd.split("/");
		//création de la date
		var dateAchievement = new Date(dateSplit[2],dateSplit[1],dateSplit[0]);			
        dateAchievement.setMonth(dateAchievement.getMonth()-1);
		
        
		var dateDuJour = new Date();
		//envoi d'un message si la date est dans le futur
		if(dateAchievement> dateDuJour)
		{
			 res.send('La date saisie est dans le futur. Merci d\'effectuer une correction.');
			 return;
		}		

		//// FIN TRAITEMENT de la Date de l'achievement
		
		var heure = achievement[2];
        if(heure.includes(',')) {
            var heure = heure.replace(',', '.');
        }
        console.log('heure: ' + heure);

        c.set('Slack_User_ID__c', slackUserId);
        c.set('Slack_User_Name__c', slackUserName);
        c.set('Achievement__c', achievement[3]);
        c.set('Nombre_Heure__c', heure);
        c.set('Domaine_Expertise__c', achievement[0]);
		c.set('Date_achievement__c', dateAchievement);
        org.insert({ sobject: c}, function(err, resp) {
            if (err) {
                console.error(err);
                res.send("Une erreur s'est produite lors de la création de votre Achievement.");
            } else {
                var fields = [];
                var valeur = 'Domaine: ' + achievement[0] + '\n' +
							 'Date de l\'achievement : '+achievement[1]+
                             'Nombre d\'heure: ' + heure + '\n' +
                             'Description: ' + achievement[2];
                console.log('valeur: ' + valeur);
                fields.push({title: "Achievement", value: valeur, short:false});
                var message = {
                    response_type: "ephemeral",
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