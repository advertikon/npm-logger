import Logger, { LoggerOptions } from 'bunyan';
import { NextFunction, Request, Response } from 'express';
import { ulid } from 'ulid';

export interface LoggerRequest extends Request {
    logger?: Logger;
    req_id?: string;
}

export const logRequest = () => {
    return function (req: LoggerRequest, resp: Response, next: NextFunction) {
        createLogger({
            name: process.env.npm_package_name as string,
            request: req,
            serializers: {
                req: (req) => {
                    return {
                        method: req.method,
                        url: req.url,
                    };
                }
            }
        });

        req.logger?.info({ req });
        next();
    }
}

export const createLogger = (opt: LoggerOptions & {request: LoggerRequest}): Logger => {
    const { request, ...options } = opt;
    const logger = Logger.createLogger(options);

    if (request) {
        const id = (request.headers['x-req-id'] ? request.headers['x-req-id'] : ulid()) as string;
        request.logger = logger.child({ req_id: id });
        request.req_id = id;
    }

    return logger;
};


