import {authorize} from './cartridge.js';
// readCampaign must use Firebase getDocFromServer; offline cache is not authorization.
export async function campaignAccess({uid,campaignId,currentUid,readCampaign}) {
 if(!uid||currentUid()!==uid||!/^[A-Za-z0-9]{20}$/.test(campaignId))throw Error('CARTRIDGE_ACCESS');
 const snapshot=await readCampaign(campaignId);
 if(!snapshot.exists()||currentUid()!==uid)throw Error('CARTRIDGE_ACCESS');
 const c=snapshot.data();
 return authorize({uid,ownerUid:c.ownerId,campaignId,rulesetId:c.ruleset,status:c.status,name:c.name});
}
