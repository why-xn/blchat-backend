const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
    _id: String,
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
    var obj = this.toObject()
    delete obj.password
    return obj
}

const GroupChatSchema = new Schema({
    _id: String,
    name: String,
    displayPicture: String,
    mode: String, // PUBLIC, PRIVATE
    status: String, // V (VALID), D (DELETED)
    createDate: Date
});

const LastMessageSchema = new Schema({ 
    msg: String,
    sender: String,
    date: Date,
    seenByRecipient: Boolean
});

const ParticipantSchema = new Schema({
    id: String,
    displayName: String,
    role: String
});

const PrivateChatSchema = new Schema({
    _id: String,
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
    delete obj.participantsInStr
    return obj
}

const ChatMessageSchema = new Schema({
    _id: String,
    chatId: String,
    chatType: String, // P (PRIVATE), G (GROUP)
    senderId: String,
    senderDisplayName: String,
    msg: String,
    status: String,
    createDate: Date
});

module.exports = {
    User: mongoose.model('User', UserSchema),
    GroupChat: mongoose.model('GroupChat', GroupChatSchema),
    PrivateChat: mongoose.model('PrivateChat', PrivateChatSchema),
    ChatMessage: mongoose.model('ChatMessage', ChatMessageSchema)
}