import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import {
  AirExtra,
  AirUser,
  AirProfile,
  AirBlock,
  AirUserRegisteredTransaction,
} from '../../../generated/schema';
import { getOrCreateAirAccount, getOrCreateAirBlock, getChainId, updateAirEntityCounter, getOrCreateAirToken } from '../common/index';
import { AirProtocolType, AirProtocolActionType, AIR_USER_REGISTERED_TRANSACTION_ENTITY_COUNTER_ID, createUserEntityId, createAirExtra } from './utils';

export namespace social {

  /**
   * @dev this function tracks a air user and profile registered transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param logOrCallIndex log or call index
   * @param airTransferData air transfer data class
   * @param airUserData air user data class
   * @param airProfileData air profile data class
   */
  export function trackUserAndProfileRegisteredTransaction(
    block: ethereum.Block,
    transactionHash: string,
    logOrCallIndex: BigInt,
    airTransferData: AirTransferData,
    airUserData: AirUserData,
    airProfileData: AirProfileData,
  ): void {
    const chainId = getChainId();
    // creating air block
    const airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    airBlock.save();
    // creating air user
    const userId = createUserEntityId(chainId, airUserData.dappUserId);
    // create air user extras
    let airUserExtras = new Array<AirExtra>();
    let airUserExtraIds = new Array<string>();
    for (let i = 0; i < airUserData.userExtras.length; i++) {
      const extra = airUserData.userExtras[i];
      const extraId = userId.concat("-").concat(extra.name);
      const airUserExtraData = createAirExtra(
        extra.name,
        extra.value,
        extraId,
      );
      airUserExtraIds.push(extraId);
      airUserExtraData.save();
      airUserExtras.push(airUserExtraData);
    }
    // create air profile extras
    let airProfileExtras = new Array<AirExtra>();
    let airProfileExtraIds = new Array<string>();
    for (let i = 0; i < airProfileData.profileExtras.length; i++) {
      const extra = airProfileData.profileExtras[i];
      const extraId = userId.concat("-").concat(extra.name);
      const airProfileExtraData = createAirExtra(
        extra.name,
        extra.value,
        extraId,
      );
      airProfileExtraIds.push(extraId);
      airProfileExtraData.save();
      airProfileExtras.push(airProfileExtraData);
    }
    // create air user
    const airUser = getOrCreateAirUser(chainId, airBlock, airUserData.dappUserId, airTransferData.to, airUserExtraIds);
    airUser.save();
    // create air profile
    const airProfile = getOrCreateAirProfile(airBlock, chainId, airUser.id, airProfileData.profileName, airTransferData.tokenId, airTransferData.tokenAddress, airProfileExtraIds);
    airProfile.save();
    // create air user registered transaction
    createAirUserRegisteredTransaction(
      chainId,
      airBlock,
      transactionHash,
      logOrCallIndex,
      airTransferData.to,
      airUser.id,
      airProfile.id,
      airProfileData.profileName,
      airTransferData.from,
      airTransferData.to,
      airTransferData.tokenId,
      airTransferData.tokenAddress,
      airUserExtraIds,
      airProfileExtraIds,
    );
  }

  /**
   * @dev this function does not save the returned entity
   * @dev this function gets or creates a AirUser entity
   * @param chainId chain id
   * @param block air block entity
   * @param dappUserId dapp user id
   * @param address air user address (owner of the dappUserId)
   * @param extrasIds air extra data entity ids
  */
  function getOrCreateAirUser(
    chainId: string,
    block: AirBlock,
    dappUserId: string,
    address: string,
    extrasIds: string[]
  ): AirUser {
    const id = createUserEntityId(chainId, dappUserId);
    let entity = AirUser.load(id);
    if (entity == null) {
      entity = new AirUser(id);
      const airAccount = getOrCreateAirAccount(chainId, address, block);
      airAccount.save();
      entity.dappUserId = dappUserId;
      entity.address = airAccount.id;
      entity.createdAt = block.id;
      if (extrasIds.length > 0) {
        entity.extras = extrasIds
      };
      entity.lastUpdatedAt = block.id;
    }
    return entity as AirUser;
  }

  /**
   * @dev this function does not save the returned entity
   * @dev this function creates a AirProfile entity
   * @param block ethereum block
   * @param chainId chain id
   * @param userId air user id
   * @param name air profile name
   * @param tokenId air profile token id
   * @param tokenAddress air profile token address
   * @param extraIds air extra data entity ids
   * @returns air profile entity
   */
  function getOrCreateAirProfile(
    block: AirBlock,
    chainId: string,
    userId: string,
    name: string,
    tokenId: string,
    tokenAddress: string,
    extraIds: string[],
  ): AirProfile {
    const id = userId.concat("-").concat(tokenAddress).concat("-").concat(tokenId);
    let entity = AirProfile.load(id);
    if (entity == null) {
      entity = new AirProfile(id);
      entity.name = name;
      entity.user = userId;
      entity.tokenId = tokenId;
      const airToken = getOrCreateAirToken(chainId, tokenAddress);
      airToken.save();
      entity.tokenAddress = airToken.id;
      if (extraIds.length > 0) {
        entity.extras = extraIds;
      }
      entity.createdAt = block.id;
      entity.lastUpdatedAt = block.id;
    }
    return entity as AirProfile;
  }

  /**
   * @dev this function creates a AirUserRegisteredTransaction entity
   * @param chainId chain id
   * @param block air block entity
   * @param transactionHash transaction hash
   * @param logOrCallIndex log or call index
   * @param address user address (owner of the dappUserId)
   * @param userId air user entity id
   * @param profileId air profile entity id
   * @param name air profile name
   * @param from address from which user token was sent
   * @param to address to which user token was sent
   * @param tokenId token id of the user token
   * @param tokenAddress token address of the user token
   * @param userExtrasIds air user extra data entity ids
   * @param profileExtraIds air profile extra data entity ids
   */
  function createAirUserRegisteredTransaction(
    chainId: string,
    block: AirBlock,
    transactionHash: string,
    logOrCallIndex: BigInt,
    address: string,
    userId: string,
    profileId: string,
    name: string,
    from: string,
    to: string,
    tokenId: string,
    tokenAddress: string,
    userExtrasIds: string[],
    profileExtraIds: string[],
  ): void {
    const id = userId.concat('-').concat(transactionHash).concat('-').concat(tokenAddress).concat('-').concat(tokenId);
    let entity = AirUserRegisteredTransaction.load(id);
    if (entity == null) {
      entity = new AirUserRegisteredTransaction(id);
      const airAccount = getOrCreateAirAccount(chainId, address, block);
      airAccount.save();
      const airAccountFrom = getOrCreateAirAccount(chainId, from, block);
      airAccountFrom.save();
      const airAccountTo = getOrCreateAirAccount(chainId, to, block);
      airAccountTo.save();
      entity.address = airAccount.id; //dappUserId owner address
      entity.user = userId;
      entity.profile = profileId;
      entity.name = name;
      if (userExtrasIds.length > 0 || profileExtraIds.length > 0) {
        entity.extras = userExtrasIds.concat(profileExtraIds); //air user extra data entity ids
      }
      entity.from = airAccountFrom.id;
      entity.to = airAccountTo.id;
      entity.tokenId = tokenId;
      const airToken = getOrCreateAirToken(chainId, tokenAddress);
      airToken.save();
      entity.tokenAddress = airToken.id;
      entity.logOrCallIndex = logOrCallIndex;
      entity.transactionHash = transactionHash;
      entity.block = block.id;
      entity.index = updateAirEntityCounter(AIR_USER_REGISTERED_TRANSACTION_ENTITY_COUNTER_ID, block);
      entity.protocolType = AirProtocolType.SOCIAL;
      entity.protocolActionType = AirProtocolActionType.REGISTRATION;
      entity.save();
    }
  }

  /**
   * @dev this class is used to create air extra data
   * @param name name of the extra data (eg: tokenUri,homeUrl,recoveryAddress)
   * @param value value of the extra data
   */
  export class AirExtraData {
    constructor(
      public name: string,
      public value: string,
    ) { }
  }

  /**
   * @dev this class is used to create air transfer data
   * @param from sender address of ERC721 token
   * @param to receiver address of ERC721 token
   * @param tokenId tokenId of the profile token that was transferred - ERC721
   * @param tokenAddress token address of the profile token that was transferred - ERC721
   */
  export class AirTransferData {
    constructor(
      public from: string,
      public to: string,
      public tokenId: string,
      public tokenAddress: string,
    ) { }
  }

  /**
   * @dev this class is used to create air user data
   * @param dappUserId dappUserId (eg: farcasterId)
   * @param userExtras extra data (eg: farcaster homeUrl and recoveryAddress)
   */
  export class AirUserData {
    constructor(
      public dappUserId: string,
      public userExtras: AirExtraData[],
    ) { }
  }

  /**
   * @dev this class is used to create air profile data
   * @param profileName profile name (eg: farcaster profile name)
   * @param profileExtras extra data (eg: farcaster profile tokenUri)
   */
  export class AirProfileData {
    constructor(
      public profileName: string,
      public profileExtras: AirExtraData[],
    ) { }
  }
}