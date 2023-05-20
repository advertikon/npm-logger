import Logger, { LoggerOptions } from 'bunyan';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ulid } from 'ulid';

export type LoggerRequest = Request & {
    logger?: Logger;
    req_id?: string;
}

interface LoggerResponse extends Response {
    start_time?: bigint;
    end_time?: bigint;
    sentry?: string;
}

type Config = {
    requestCb?: (r: Request) => Record<string, string>;
    responseCb?: (r: Response) => Record<string, string>;
}

export const logRequest = (config?: Config): RequestHandler => {
    return function (req: LoggerRequest, resp: LoggerResponse, next: NextFunction) {
        resp.start_time = process.hrtime.bigint();

        createLogger({
            name: process.env.npm_package_name as string,
            request: req,
            serializers: {
                req: (req: LoggerRequest) => {
                    const data = {
                        method: req.method,
                        url: req.url,
                    };

                    if (config?.requestCb) {
                        return { ...data, ...config.requestCb(req) }
                    }

                    return data;
                },
                resp: (resp: LoggerResponse) => {
                    const data = {
                        time: Number(BigInt(resp.end_time ?? 0) - BigInt(resp.start_time ?? 0)) / 1000000000,
                        error_id: resp.sentry ?? '',
                        status_code: resp.statusCode
                    };

                    if (config?.responseCb) {
                        return { ...data, ...config?.responseCb(resp) }
                    }

                    return data;
                }
            }
        });

        resp.on('finish', () => {
            resp.end_time = process.hrtime.bigint();
            req.logger?.info({ resp: resp }, 'Request end');
        });

        req.logger?.info({ req }, 'Request start');
        next();
    }
}

export const createLogger = (opt: LoggerOptions & {request?: LoggerRequest}): Logger => {
    const { request, ...options } = opt;
    const logger = Logger.createLogger(options);

    if (request) {
        const id = (request.headers['x-req-id'] ? request.headers['x-req-id'] : ulid()) as string;
        request.logger = logger.child({ req_id: id });
        request.req_id = id;
    }

    return logger;
};


