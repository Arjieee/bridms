import { v4 as uuidv4 } from 'uuid';

export { uuidv4 };

export const shortId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateQrToken = () => {
  return uuidv4();
};
