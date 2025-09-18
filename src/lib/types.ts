export type PollOption = {
  title: string
  percentage: number
  image?: string // Optional image URL for the option
}

export type PollUser = {
  name: string
  avatar: string
}

export type Poll = {
  id: number
  user: PollUser
  title: string
  category: string
  image?: string // Optional image for the poll question itself
  options: PollOption[]
  votedOptionIndex: number | null
  likes: number
  comments: number
}
