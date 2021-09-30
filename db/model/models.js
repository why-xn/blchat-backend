const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
    id: String,
    displayName:  String,
    displayPicture: String,
    username: { type: String, unique: true },
    password: String,
    activeConnections: Number,
    role: String, // ADMIN, VISITOR, EXHIBITOR
    token: String,
    status: String, // V (VALID), D (DELETED)
    createDate: Date
});

UserSchema.methods.toJSON = function() {
    var obj = this.toObject();
    delete obj._id;
    delete obj.password;
    return obj;
}




const GroupChatSchema = new Schema({
    id: String,
    name: String,
    displayPicture: String,
    mode: String, // PUBLIC, PRIVATE
    status: String, // V (VALID), D (DELETED)
    createDate: Date
});

GroupChatSchema.methods.toJSON = function() {
    var obj = this.toObject();
    delete obj._id;
    return obj;
}





const LastMessageSchema = new Schema({ 
    msg: String,
    sender: String,
    date: Date,
    seenByRecipient: Boolean
});

LastMessageSchema.methods.toJSON = function() {
    var obj = this.toObject();
    delete obj._id;
    return obj;
}

const ParticipantSchema = new Schema({
    id: String,
    displayName: String,
    role: String
});

ParticipantSchema.methods.toJSON = function() {
    var obj = this.toObject();
    delete obj._id;
    return obj;
}

const PrivateChatSchema = new Schema({
    id: String,
    participants: [ParticipantSchema],
    participantsInStr: String,
    type: String, // V2V (VISITOR TO VISITOR), V2E (VISITOR TO EXHIBITOR)
    state: String, // REQUESTED, APPROVED
    requestedBy: String,
    lastMessage: LastMessageSchema,
    status: String, // V (VALID), D (DELETED)
    createDate: Date,
    createdBy: String
});

PrivateChatSchema.methods.toJSON = function() {
    var obj = this.toObject()
    delete obj._id;
    delete obj.participantsInStr
    return obj
}





const ChatMessageSchema = new Schema({
    id: String,
    chatId: String,
    chatType: String, // P (PRIVATE), G (GROUP)
    senderId: String,
    senderDisplayName: String,
    msg: String,
    status: String,
    createDate: Date
});

ChatMessageSchema.methods.toJSON = function() {
    var obj = this.toObject();
    delete obj._id;
    return obj;
}




module.exports = {
    User: mongoose.model('User', UserSchema),
    GroupChat: mongoose.model('GroupChat', GroupChatSchema),
    PrivateChat: mongoose.model('PrivateChat', PrivateChatSchema),
    ChatMessage: mongoose.model('ChatMessage', ChatMessageSchema)
}