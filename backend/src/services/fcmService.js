import admin from '../config/firebase_client.js';
import dotenv from 'dotenv';
dotenv.config();



class FCMService {
  constructor() {
    this.messaging = admin.messaging();
  }

  async sendNotification(token, title, body, data = {}) {
    const message = {
      notification: {
        title,
        body,
      },
      data: this.stringifyData(data), // FCM requires all data values to be strings
      token,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await this.messaging.send(message);
      console.log('Successfully sent message:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToMultipleDevices(tokens, title, body, data = {}) {
    const message = {
      notification: {
        title,
        body,
      },
      data: this.stringifyData(data),
      tokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await this.messaging.sendMulticast(message);
      console.log(`Successfully sent to ${response.successCount} devices`);
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        return { 
          success: true, 
          successCount: response.successCount,
          failureCount: response.failureCount,
          failedTokens 
        };
      }
      
      return { success: true, successCount: response.successCount };
    } catch (error) {
      console.error('Error sending to multiple devices:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to convert all data values to strings
  stringifyData(data) {
    const stringifiedData = {};
    for (const [key, value] of Object.entries(data)) {
      stringifiedData[key] = String(value);
    }
    return stringifiedData;
  }

  // Method to validate FCM tokens
  async validateToken(token) {
    try {
      await this.messaging.send({
        token,
        data: { test: 'validation' },
      }, true); // dry run
      return true;
    } catch (error) {
      return false;
    }
  }
}

const fcmService = new FCMService();
export default fcmService;