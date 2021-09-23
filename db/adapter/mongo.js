const mongoose = require('mongoose');

module.exports = {
    initConnection: function() {
        mongoose.connect('mongodb://mongoAdmin:abc123@localhost:27017/blchat?authSource=admin&readPreference=primary').
        then(res => {
            console.log('DB (Mongo) connection initialized');
        }).
        catch(error => {
            console.log(error);
        });
    },
    test: function() {
        const Cat = mongoose.model('Cat', { name: String });
        const kitty = new Cat({ name: 'Zildjian' });
        kitty.save().then(() => console.log('meow'));
    }
}
