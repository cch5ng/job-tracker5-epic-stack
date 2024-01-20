import { PrismaClient } from '@prisma/client'
import { createSchema } from 'graphql-yoga'
import { type Context } from './context.js'

const prisma = new PrismaClient()
 
export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      JobById(id: ID!): Job
      JobsByUserId(userId: ID!): [Job]
      CompanyById(id: ID!): Company
      companiesByUserId(userId: ID!): [Company]
      EventById(id: ID!): Event
      EventsByUserId(userId: ID!): [Event]
      EventsByJobId(jobId: ID!): [Event]
    }

    type Mutation {
      CreateJob(name: String!, user_id: ID!, status: String, description: String, url: String, questions: String, source: String, company_id: ID, company_name: String, company_description: String, company_purpose: String): Job!
      UpdateJob(id: ID!, name: String, status: String, description: String, url: String, questions: String, source: String, company_name: String, company_description: String, company_purpose: String, company_id: ID): Job!
      CreateEvent(format: String, contact: String, notes: String, description: String, follow_up: String, job_id: ID!, user_id: ID!, date_time: String): Event
      UpdateEvent(id: ID!, format: String, contact: String, notes: String, description: String, follow_up: String, date_time: String): Event
      DeleteEvent(id: ID!): Event
      CreateCompany(company_name: String!, company_description: String, company_purpose: String): Company
      UpdateCompany: Company
    }

    type Job {
        id: ID
        name: String
        status: String
        description: String 
        url: String 
        company: Company
        questions: String
        source: String 
        guid: String
        created_at: String
    }

    type Company {
        id: ID
        company_name: String
        company_purpose: String 
        company_description: String
        financial: String
    }

    type Event {
        format: String 
        contact: String
        notes: String
        description: String
        follow_up: String
        job_id: Int
        user_id: Int
        date_time: String
    }
  `,

  resolvers: {
    Query: {
      JobById: (_parent, _args, context: Context) => {
          return prisma.job.findUnique({
              where: { id: parseInt(_args.id, 10) || undefined },
          })
      },
      CompanyById: (_parent, _args, context: Context) => {
        return prisma.company.findUnique({
            where: { id: parseInt(_args.id, 10) || undefined },
        })
      },
      JobsByUserId: (_parent, _args, context: Context) => {
        return prisma.job.findMany({
            where: {
              jobstracker2_users: {
                some: {
                  user_id: parseInt(_args.userId, 10) || undefined 
                }
              }
            },
        })
      },
      EventById: (_parent, _args, context: Context) => {
        return prisma.event.findUnique({
            where: { id: parseInt(_args.id, 10) || undefined },
        })
      },
      EventsByUserId: (_parent, _args, context: Context) => {
        return prisma.event.findMany({
            where: {
              user_id: parseInt(_args.userId, 10) || undefined 
            }
        })
      },
      EventsByJobId: (_parent, _args, context: Context) => {
        return prisma.event.findMany({
            where: {
              job_id: parseInt(_args.jobId, 10) || undefined 
            }
        })
      }
    },
    Mutation: {
      CreateJob: async (_parent, _args, context: Context) => {
        //see if the company exists
        //if exists use connect
        //if not exists use create

        //TODO review if this should be findFirst vs findUnique (think UNIQUE constraint not applied)
        // const company = await prisma.company.findFirst({
        //   where: {
        //     company_name: _args.company_name
        //   }
        // })

        const job = await prisma.job.create({
                    data: { 
                      name: _args.name,
                      status: _args.status,
                      description: _args.description,
                      url: _args.url,
                      questions: _args.questions,
                      source: _args.source,
                      company: {
                        connectOrCreate: {
                          where: {
                            company_name: _args.company_name     
                            //company_name: parseInt(_args.company_id, 10),
                          },
                          create: {
                            company_name: _args.company_name,
                            company_description: _args.company_description,
                            company_purpose: _args.company_purpose
                          }
                        }
                      }
                    }
                  })

        // const job = company ? 
        //   await prisma.job.create({
        //     data: { 
        //       name: _args.name,
        //       status: _args.status,
        //       description: _args.description,
        //       url: _args.url,
        //       questions: _args.questions,
        //       source: _args.source,
        //       company: {
        //         connect: {
        //           id: _args.company.company_id,
        //         }
        //       }
        //     }
        //   })
        // : await prisma.job.create({
        //   data: { 
        //     name: _args.name,
        //     status: _args.status,
        //     description: _args.description,
        //     url: _args.url,
        //     questions: _args.questions,
        //     source: _args.source,
        //     company: {
        //       create: {
        //         company_name: _args.company_name,
        //         company_description: _args.company_description,
        //         company_purpose: _args.company_purpose
        //       },
        //     },
        //   }
        // })

        const job_user = await prisma.job_user.create({
          data: {
            job_id: job.id,
            user_id: parseInt(_args.user_id, 10),
          }
        })
        console.log('job_user', job_user)

        return job;
      },
      UpdateJob: (_parent, _args, context: Context) => {
        //TODO had issue with upsert
        return prisma.job.update({
          where: {
            id: parseInt(_args.id, 10) || undefined 
          },
          data: {
              name: _args.name,
              status: _args.status,
              description: _args.description,
              url: _args.url,
              questions: _args.questions,
              source: _args.source,
              company: {
                upsert: {
                  where: {
                    id: parseInt(_args.company_id, 10)
                  },
                  update: {
                    company_name: _args.company_name,
                    company_description: _args.company_description,
                    company_purpose: _args.company_purpose
                  },
                  create: {
                    company_name: _args.company_name,
                    company_description: _args.company_description,
                    company_purpose: _args.company_purpose
                  },
                },
              }
            }
        })
      },
      CreateEvent: (_parent, _args, context: Context) => {
        return prisma.event.create({
          data: {
            format: _args.format,
            contact: _args.contact,
            notes: _args.notes,
            description: _args.description,
            follow_up: _args.follow_up,
            job_id: parseInt(_args.job_id, 10),
            user_id: parseInt(_args.user_id, 10),
            date_time: _args.date_time,
          }
        })
      },
      UpdateEvent: (_parent, _args, context: Context) => { 
        return prisma.event.update({
          where: {
            id: parseInt(_args.id, 10) || undefined 
          },
          data: {
            format: _args.format,
            contact: _args.contact,
            notes: _args.notes,
            description: _args.description,
            follow_up: _args.follow_up,
            date_time: _args.date_time,
          }
        })
      },
      DeleteEvent: (_parent, _args, context: Context) => { 
        return prisma.event.delete({
          where: {
            id: parseInt(_args.id, 10) || undefined 
          }
        })
      },
    }
  }
})
