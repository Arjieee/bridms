/**
 * User Agent & Device Info Parser for Session Security
 */
export function parseUserAgent(userAgentString = '') {
  const ua = userAgentString.toLowerCase();

  // Browser detection
  let browser = 'Unknown Browser';
  if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Google Chrome';
  else if (ua.includes('firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Apple Safari';
  else if (ua.includes('msie') || ua.includes('trident/')) browser = 'Internet Explorer';

  // OS detection
  let os = 'Unknown OS';
  if (ua.includes('windows nt 10.0')) os = 'Windows 10/11';
  else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  // Device Type
  let deviceType = 'Desktop';
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    deviceType = 'Mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    deviceType = 'Tablet';
  }

  return { browser, os, deviceType };
}
