const mongoose = require('mongoose');

module.exports = {
    initConnection: function() {
        var connectionString = `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_DBNAME}?readPreference=primary`;
        if (process.env.MONGODB_AUTH_ENABLED === "1") {
            connectionString = `mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_DBNAME}?authSource=admin&readPreference=primary`;
        }
        mongoose.connect(connectionString).
        then(res => {
            console.log('DB (Mongo) connection initialized');
        }).
        catch(error => {
            console.log(error);
        });
    }
}
