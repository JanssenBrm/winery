import * as functions from 'firebase-functions';
import { getUserId } from '../services/security.service';
import { sendError } from './error.utils';
import { constants } from 'http2';

export const authRequest = async (
  req: functions.Request,
  res: functions.Response,
  handler: (req: functions.Request, res: functions.Response, userId: string) => void
) => {
  const uid = await getUserId(req, res);
  if (!uid) {
    sendError(res, constants.HTTP_STATUS_UNAUTHORIZED);
  } else {
    return handler(req, res, uid);
  }
};
