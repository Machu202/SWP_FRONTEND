import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const messenger = read("src/components/DirectMessenger.jsx");
const layout = read("src/components/Layout.jsx");
const client = read("src/api/client.js");
const css = read("src/styles.css");
const entity = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/entity/DirectChatMessage.java");
const repository = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/repository/DirectChatMessageRepository.java");
const controller = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/controller/DirectChatController.java");
const service = read("../SWP_BACKEND/src/main/java/com/mangastudio/backend/service/impl/DirectChatServiceImpl.java");
const backendTests = read("../SWP_BACKEND/src/test/java/com/mangastudio/backend/DirectChatServiceTests.java");

assert.match(entity, /@Entity/);
assert.match(entity, /Direct_Chat_Message/,
  "Direct messages must be stored in their own database table");
assert.match(entity, /sender_id/);
assert.match(entity, /recipient_id/);
assert.match(entity, /created_at/);
assert.match(entity, /read_at/);
assert.match(repository, /findConversation/);
assert.match(repository, /countByRecipient_IdAndSender_IdAndReadAtIsNull/);
assert.match(repository, /markConversationRead/);
assert.match(repository, /ORDER BY message\.createdAt ASC, message\.id ASC/,
  "Messages must be returned in stable chronological order");

assert.match(service, /MANGAKA[\s\S]*ASSISTANT/);
assert.match(service, /MANGAKA[\s\S]*TANTOU EDITOR/);
assert.match(service, /Direct chat is allowed only between Mangaka and Assistant or Mangaka and Tantou Editor/,
  "Backend must reject every other role pairing");
assert.match(service, /MAX_MESSAGE_LENGTH = 2000/);
assert.match(backendTests, /assistantAndTantouCannotOpenDirectChat/);

assert.match(controller, /@RequestMapping\("\/api\/v1\/direct-chat"\)/);
assert.match(controller, /@GetMapping\("\/contacts"\)/);
assert.match(controller, /@GetMapping\("\/users\/\{otherUserId\}\/messages"\)/);
assert.match(controller, /@PostMapping\("\/users\/\{recipientId\}\/messages"\)/);
assert.match(client, /directChat:[\s\S]*contacts:[\s\S]*list:[\s\S]*send:/);

assert.match(layout, /<DirectMessenger currentUserId=/);
assert.match(layout, /\["mangaka", "assistant", "tantou"\]\.includes\(group\)/,
  "Messenger must appear globally for the three requested roles only");
assert.match(messenger, /api\.directChat\.contacts\(\)/,
  "Contacts must come from authorized task and series relationships, not a role-wide user directory");
assert.match(messenger, /contactSeriesLabel\(contact\)/);
assert.match(messenger, /direct-messenger-unread-count/);
assert.match(messenger, /totalUnread > 99 \? "99\+" : totalUnread/);
assert.match(messenger, /window\.setInterval\(\(\) => loadMessages\(true\), 5000\)/,
  "Open conversations must refresh every five seconds");
assert.match(messenger, /api\.directChat\.send\(selectedContactId, content\)/);
assert.match(messenger, /aria-label=\{open \? "Minimize direct messenger" : "Open direct messenger"\}/);

assert.match(css, /\.direct-messenger[\s\S]*position: fixed[\s\S]*right: 22px[\s\S]*bottom: 20px/);
assert.match(css, /direct-messenger-mangaka[\s\S]*#ef4444/,
  "Mangaka Messenger icon must be red");
assert.match(css, /direct-messenger-assistant[\s\S]*#22c55e/,
  "Assistant Messenger icon must be green");
assert.match(css, /direct-messenger-tantou[\s\S]*#a855f7/,
  "Tantou Messenger icon must be purple");

console.log("SWP15 direct Messenger contract: PASS");
