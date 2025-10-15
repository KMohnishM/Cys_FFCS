export type Role = 'member' | 'admin' | 'superadmin'

export interface User {
  userId: string
  name: string
  email: string
  role: Role
  departments?: string[]
  totalPoints?: number
  projectId?: string | null
}

export interface Department {
  deptId: string
  name: string
  capacity: number
  filledCount: number
}

export interface Project {
  projectId: string
  name: string
  description: string
  members: string[]
  department?: string
  reviewIds?: string[]
}

export interface Contribution {
  contribId: string
  userId: string
  projectId?: string
  text: string
  imageUrl?: string
  status: 'pending' | 'verified' | 'rejected'
  pointsAwarded?: number
  verifiedBy?: string
  verifiedAt?: any
  createdAt?: any
}
