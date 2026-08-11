import { addDoc, collection } from 'firebase/firestore'
import { db } from './firebase'
import type { NotificationType } from '@/types'

interface CreateNotificationParams {
  user_id: string
  type: NotificationType
  title: string
  body: string
  link: string
}

export async function createNotification({ user_id, type, title, body, link }: CreateNotificationParams) {
  try {
    await addDoc(collection(db, 'notifications'), {
      user_id,
      type,
      title,
      body,
      read: false,
      link,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}
