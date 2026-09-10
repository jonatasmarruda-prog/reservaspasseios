import admin from 'firebase-admin';

export function getAdmin(){
  if(admin.apps.length)return admin;
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT||'';
  if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT ausente');
  const service=JSON.parse(raw);
  admin.initializeApp({credential:admin.credential.cert(service)});
  return admin;
}
export function getDb(){return getAdmin().firestore()}
export async function verifyFirebaseBearer(req){
  const h=String(req.headers.authorization||'');
  if(!h.startsWith('Bearer '))throw Object.assign(new Error('Não autenticado'),{status:401});
  return getAdmin().auth().verifyIdToken(h.slice(7));
}
