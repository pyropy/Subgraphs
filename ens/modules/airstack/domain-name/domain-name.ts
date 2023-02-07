import {
  BigInt,
  Bytes,
  crypto,
  log,
  ByteArray,
  ens,w
  ethereum,
} from "@graphprotocol/graph-ts";

import {
  AirAccount,
  AirToken,
  AirBlock,
  AirDomain,
  AirDomainOwnerChangedTransaction,
  AirDomainTransferTransaction,
  AirResolver,
  AirDomainNewResolverTransaction,
  AirDomainNewTTLTransaction,
  AirNameRegisteredTransaction,
  AirNameRenewedTransaction,
  AirResolvedAddressChanged,
  AirPrimaryDomainTransaction,
  ReverseRegistrar,
  PrimaryDomain,
  AirExtra,
} from "../../../generated/schema";
import { AIR_EXTRA_TTL, AIR_SET_PRIMARY_DOMAIN_ENTITY_COUNTER_ID, AIR_DOMAIN_OWNER_CHANGED_ENTITY_COUNTER_ID, AIR_ADDR_CHANGED_ENTITY_COUNTER_ID, AIR_NAME_RENEWED_ENTITY_COUNTER_ID, AIR_NAME_REGISTERED_ENTITY_COUNTER_ID, AIR_DOMAIN_NEW_TTL_ENTITY_COUNTER_ID, AIR_DOMAIN_NEW_RESOLVER_ENTITY_COUNTER_ID, AIR_DOMAIN_TRANSFER_ENTITY_COUNTER_ID, ROOT_NODE, ZERO_ADDRESS, ETHEREUM_MAINNET_ID } from "./utils";
import { BIGINT_ONE, BIG_INT_ZERO, EMPTY_STRING, processChainId, updateAirEntityCounter, getOrCreateAirBlock, getOrCreateAirAccount } from "../common";

export namespace domain {
  /**
   * @dev This function tracks a domain owner change transaction
   * @param block ethreum block
   * @param transactionHash transaction hash
   * @param logOrCallIndex txn log or call index
   * @param domainId domain id
   * @param parentDomainId specifies the parentDomainId
   * @param tokenId token id
   * @param labelHash specifies the label hash
   * @param labelName label name
   * @param name domain name
   * @param newOwner specifies the new owner of the domain
   * @param tokenAddress contract address of nft token
  */
  export function trackDomainOwnerChangedTransaction(
    block: ethereum.Block,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domainId: string,
    parentDomainId: string,
    tokenId: string,
    labelHash: string,
    labelName: string | null,
    name: string | null,
    newOwner: string,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let domain = getOrCreateAirDomain(new Domain(domainId, chainId, airBlock, tokenAddress));
    let previousOwnerId = domain.owner;
    let parent = getOrCreateAirDomain(new Domain(
      parentDomainId,
      chainId,
      airBlock,
      tokenAddress,
    ));
    if (domain.parent == null && parent != null) {
      parent.subdomainCount = parent.subdomainCount.plus(BIGINT_ONE);
    }
    domain.name = name;
    domain.labelName = labelName;
    domain.owner = getOrCreateAirAccount(chainId, newOwner, airBlock).id;
    domain.parent = parent.id;
    domain.labelHash = labelHash;
    domain.tokenId = tokenId;
    domain.lastBlock = airBlock.id;
    recurseSubdomainCountDecrement(domain, chainId, airBlock, tokenAddress);
    domain.save();

    getOrCreateAirDomainOwnerChangedTransaction(
      airBlock,
      logOrCallIndex,
      chainId,
      previousOwnerId,
      newOwner,
      transactionHash,
      tokenId,
      domain,
    );
  }

  /**
   * @dev This function tracks a domain transfer transaction
    * @param block ethereum block
    * @param transactionHash transaction hash
    * @param logOrCallIndex txn log or call index
    * @param domainId domain id
    * @param newOwnerAddress specifies the new owner of the domain
    * @param tokenAddress contract address of nft token
   */
  export function trackDomainTransferTransaction(
    block: ethereum.Block,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domainId: string,
    newOwnerAddress: string,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let domain = getOrCreateAirDomain(new Domain(domainId, chainId, airBlock, tokenAddress));
    let previousOwnerId = domain.owner;
    if (previousOwnerId == null) {
      previousOwnerId = getOrCreateAirAccount(chainId, ZERO_ADDRESS, airBlock).id;
    }
    // update domain owner here
    domain.owner = getOrCreateAirAccount(chainId, newOwnerAddress, airBlock).id;
    domain.save();
    let id = createEntityId(transactionHash, block.number, logOrCallIndex);
    let entity = AirDomainTransferTransaction.load(id);
    if (entity == null) {
      entity = new AirDomainTransferTransaction(id);
      entity.from = previousOwnerId;
      entity.to = getOrCreateAirAccount(chainId, newOwnerAddress, airBlock).id;
      entity.block = airBlock.id;
      entity.transactionHash = transactionHash;
      entity.tokenId = domain.tokenId;
      entity.domain = domain.id;
      entity.index = updateAirEntityCounter(AIR_DOMAIN_TRANSFER_ENTITY_COUNTER_ID, airBlock);
      entity.save();
    }
  }

  /**
   * @dev This function tracks a new resolver transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param logOrCallIndex txn log or call index
   * @param domainId air domain id
   * @param resolver resolver contract address
   * @param tokenAddress contract address of nft token
   */
  export function trackDomainNewResolverTransaction(
    block: ethereum.Block,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domainId: string,
    resolver: string,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    // get block
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    // get domain
    let domain = getOrCreateAirDomain(new Domain(domainId, chainId, airBlock, tokenAddress));
    // get previous resolver
    let previousResolverId = domain.resolver;
    // create new resolver
    let resolverEntity = getOrCreateAirResolver(domain, chainId, airBlock, resolver);
    // update domain resolver
    domain.resolver = resolverEntity.id;
    // update domain resolved address
    if (resolverEntity.resolvedAddress) {
      domain.resolvedAddress = resolverEntity.resolvedAddress;
    }
    // do recursive subdomain count decrement
    domain.lastBlock = airBlock.id;
    recurseSubdomainCountDecrement(domain, chainId, airBlock, tokenAddress);
    domain.save();

    // create new resolver transaction
    getOrCreateAirDomainNewResolverTransaction(
      previousResolverId,
      resolverEntity.address,
      airBlock,
      transactionHash,
      logOrCallIndex,
      domain,
    )
  }

  /**
   * @dev This function tracks a new TTL transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param logOrCallIndex txn log or call index
   * @param domainId air domain id
   * @param newTTL new TTL
   * @param tokenAddress contract address of nft token
   */
  export function trackDomainNewTTLTransaction(
    block: ethereum.Block,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domainId: string,
    newTTL: BigInt,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    // get block
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    // get domain
    let domain = getOrCreateAirDomain(new Domain(domainId, chainId, airBlock, tokenAddress));
    // get previous ttl
    let oldTTL: BigInt | null = null;
    // load extra entity for ttl
    let extra = AirExtra.load(domainId.concat("-").concat(AIR_EXTRA_TTL));
    if (extra != null) {
      // if exists, assign oldTTL and update value with newTTL
      oldTTL = BigInt.fromString(extra.value);
      extra.value = newTTL.toString();
    } else {
      // else create new extra entity for ttl
      extra = createAirExtra(AIR_EXTRA_TTL, newTTL.toString(), domainId);
    }
    extra.save();
    domain.lastBlock = airBlock.id;
    domain.save();
    // create AirDomainNewTTLTransaction
    getOrCreateAirDomainNewTTLTransaction(
      transactionHash,
      block.number,
      logOrCallIndex,
      oldTTL,
      newTTL,
      airBlock,
      domain,
    )
  }

  /**
   * @dev This function tracks a new name registered transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param logOrCallIndex txn log or call index
   * @param domainId air domain id
   * @param registrantAddress registrant address
   * @param expiryTimestamp domain expiry date
   * @param cost domain registration cost
   * @param paymentToken payment token address
   * @param labelName domain label name
   * @param tokenAddress contract address of nft token
   */
  export function trackNameRegisteredTransaction(
    block: ethereum.Block,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domainId: string,
    registrantAddress: string,
    expiryTimestamp: BigInt,
    cost: BigInt | null,
    paymentToken: string,
    labelName: string | null,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    // prep mapping data
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let domain = getOrCreateAirDomain(new Domain(
      domainId,
      chainId,
      airBlock,
      tokenAddress,
    ));
    if (labelName != null) {
      domain.labelName = labelName
    }
    domain.expiryTimestamp = expiryTimestamp;
    domain.lastBlock = airBlock.id;
    if (cost) {
      domain.registrationCost = cost;
    }
    domain.paymentToken = getOrCreateAirToken(chainId, paymentToken).id;
    domain.save();
    // create name registered transaction
    getOrCreateAirNameRegisteredTransaction(
      chainId,
      block.number,
      block.hash.toHexString(),
      block.timestamp,
      transactionHash,
      logOrCallIndex,
      domain,
      cost,
      paymentToken,
      registrantAddress,
      expiryTimestamp,
    );
  }

  /**
   * @dev This function tracks a name renewal transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param domainId air domain id
   * @param cost cost of renewal
   * @param paymentToken payment token address
   * @param renewer renewer address
   * @param expiryTimestamp expiry date
   * @param tokenAddress token address
   */
  export function trackNameRenewedTransaction(
    block: ethereum.Block,
    transactionHash: string,
    domainId: string,
    cost: BigInt | null,
    paymentToken: string,
    renewer: string,
    expiryTimestamp: BigInt,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let domain = getOrCreateAirDomain(new Domain(
      domainId,
      chainId,
      airBlock,
      tokenAddress,
    ));
    domain.expiryTimestamp = expiryTimestamp;
    domain.lastBlock = airBlock.id;
    domain.save();
    // create name renewed transaction
    getOrCreateAirNameRenewedTransaction(
      transactionHash,
      chainId,
      airBlock,
      domain,
      cost,
      paymentToken,
      renewer,
      expiryTimestamp,
    );
  }

  /**
   * @dev This function tracks trackNameRenewedOrRegistrationByController transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param domainId air domain id
   * @param name domain name
   * @param labelHash label hash
   * @param cost cost - still needs to be recorded
   * @param paymentToken payment token address
   * @param renewer renewer address - can be null
   * @param expiryTimestamp expiry date - can be null
   * @param fromRegistrationEvent true if called from a registration event
   * @param tokenAddress contract address of nft token
   */
  export function trackNameRenewedOrRegistrationByController(
    block: ethereum.Block,
    transactionHash: string,
    domainId: string,
    name: string,
    labelHash: Bytes,
    cost: BigInt,
    paymentToken: string,
    renewer: string | null,
    expiryTimestamp: BigInt | null,
    fromRegistrationEvent: boolean,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    const calculatedLabelHash = crypto.keccak256(ByteArray.fromUTF8(name));
    if (!calculatedLabelHash.equals(labelHash)) {
      log.warning(
        "Expected '{}' to hash to {}, but got {} instead. Skipping.",
        [name, calculatedLabelHash.toHex(), labelHash.toHex()]
      );
      return;
    }

    if (name.indexOf(".") !== -1) {
      log.warning("Invalid label '{}'. Skipping.", [name]);
      return;
    }
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let domain = getOrCreateAirDomain(new Domain(
      domainId,
      chainId,
      airBlock,
      tokenAddress,
    ));

    // tracking registration cost in domain entity  - renewal cost is not being tracked yet
    if (fromRegistrationEvent) {
      domain.registrationCost = cost;
      domain.paymentToken = getOrCreateAirToken(chainId, paymentToken).id;
      domain.lastBlock = airBlock.id;
    } else {
      // name renewal event
      // updating renewal cost in name renewed transaction entity
      domain.expiryTimestamp = expiryTimestamp!;
      getOrCreateAirNameRenewedTransaction(
        transactionHash,
        chainId,
        airBlock,
        domain,
        cost,
        paymentToken,
        renewer!,
        expiryTimestamp!,
      );
    }
    if (domain.labelName !== name) {
      domain.labelName = name
      domain.name = name + '.eth'
      domain.lastBlock = airBlock.id;
      // creating reverse registrar to get domainId when setting primary domain
      if (domain.name) {
        createReverseRegistrar(domain.name!, domain.id, airBlock);
      }
    }
    domain.save();
    //new name registered event
  }

  /**
   * @dev This function tracks a resolved address changed transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param logOrCallIndex txn log or call index
   * @param domainId air domain id
   * @param resolverAddress resolver contract address
   * @param resolvedAddress resolved address of domain
   * @param tokenAddress contract address of nft token
   */
  export function trackResolvedAddressChangedTransaction(
    block: ethereum.Block,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domainId: string,
    resolverAddress: string,
    resolvedAddress: string,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let addrAccount = getOrCreateAirAccount(chainId, resolvedAddress, airBlock);
    let domain = getOrCreateAirDomain(new Domain(domainId, chainId, airBlock, tokenAddress));
    let previousResolvedAddressId = domain.resolvedAddress;
    let resolver = getOrCreateAirResolver(domain, chainId, airBlock, resolverAddress, resolvedAddress);
    resolver.domain = domain.id;
    resolver.save()

    if (domain.resolver == resolver.id) {
      domain.resolvedAddress = addrAccount.id;
      domain.lastBlock = airBlock.id;
      domain.save();
    }

    getOrCreateAirResolvedAddressChanged(
      chainId,
      logOrCallIndex,
      resolver,
      airBlock,
      transactionHash,
      previousResolvedAddressId,
      resolvedAddress,
      domain,
    );
  }

  /**
   * @dev This function tracks a resolver version change
   * @param block ethereum block
   * @param domainId air domain id
   * @param resolverAddress resolver contract address
   * @param tokenAddress contract address of nft token
   */
  export function trackResolverVersionChange(
    block: ethereum.Block,
    domainId: string,
    resolverAddress: string,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let domain = getOrCreateAirDomain(new Domain(domainId, chainId, airBlock, tokenAddress));
    let resolver = getOrCreateAirResolver(domain, chainId, airBlock, resolverAddress, null);
    if (domain && domain.resolver === resolver.id) {
      domain.resolvedAddress = null
      domain.lastBlock = airBlock.id;
      domain.save();
    }
  }

  /**
   * @dev This function tracks a set primary domain transaction
   * @param block ethereum block
   * @param transactionHash transaction hash
   * @param domainName domain name
   * @param from event.from address
   * @param tokenAddress contract address of nft token
   */
  export function trackSetPrimaryDomainTransaction(
    block: ethereum.Block,
    transactionHash: string,
    domainName: string,
    from: string,
    tokenAddress: string,
  ): void {
    let chainId = processChainId();
    let airBlock = getOrCreateAirBlock(chainId, block.number, block.hash.toHexString(), block.timestamp);
    let reverseRegistrar = getReverseRegistrar(domainName);
    if (reverseRegistrar == null) {
      log.warning("Reverse registrar not found for name {} txhash {}", [domainName, transactionHash]);
      return;
    }
    log.info("Reverse registrar found for name {} domainId {} txHash {}", [domainName, reverseRegistrar.domain, transactionHash])
    let domain = getOrCreateAirDomain(new Domain(reverseRegistrar.domain, chainId, airBlock, tokenAddress));
    let fromAccount = getOrCreateAirAccount(chainId, from, airBlock);
    // when domain's resolvedAddress is set as from address
    if (domain.resolvedAddress == fromAccount.id) {
      // get or create primary domain entity
      let primaryDomainEntity = getOrCreatePrimaryDomain(domain, fromAccount, airBlock);
      // when primary domain already exists for a resolved address and is not same as new domain
      if (primaryDomainEntity.domain != domain.id) {
        log.info("Primary domain already exists for resolvedAddressId {} oldDomain {} newDomain {}", [fromAccount.id, primaryDomainEntity.domain, domain.id])
        // unset isPrimary on old domain
        let oldPrimaryDomain = getOrCreateAirDomain(new Domain(primaryDomainEntity.domain, chainId, airBlock, tokenAddress));
        oldPrimaryDomain.isPrimary = false;
        oldPrimaryDomain.lastBlock = airBlock.id;
        oldPrimaryDomain.save();
        // set new primary domain for resolved address
        primaryDomainEntity.domain = domain.id;
        primaryDomainEntity.lastUpdatedAt = airBlock.id;
        primaryDomainEntity.save();
      }
      // set isPrimary on new domain
      domain.isPrimary = true;
      domain.lastBlock = airBlock.id;
      domain.save();
    }
    // record a set primary domain transaction with new domain
    getOrCreateAirPrimaryDomainTransaction(
      airBlock,
      transactionHash,
      domain,
      from,
      chainId,
    )
  }

  // end of track functions and start of get or create and helper functions
  /**
   * @dev this function creates an air extra entity
   * @param name air extra name
   * @param value air extra value
   * @param domainId air domain id
   * @returns air extra entity
   */
  function createAirExtra(
    name: string,
    value: string,
    domainId: string,
  ): AirExtra {
    let id = domainId.concat("-").concat(name);
    let entity = AirExtra.load(id);
    if (entity == null) {
      entity = new AirExtra(id);
      entity.name = name;
      entity.value = value;
      entity.domain = domainId;
    }
    return entity as AirExtra;
  }

  /**
   * @dev This function gets or creates a primary domain entity
   * @param domain air domain
   * @param fromAccount air account
   * @param block air block
   * @returns primary domain entity
   */
  function getOrCreatePrimaryDomain(
    domain: AirDomain,
    fromAccount: AirAccount,
    block: AirBlock,
  ): PrimaryDomain {
    let id = fromAccount.id;
    let entity = PrimaryDomain.load(id);
    if (entity == null) {
      entity = new PrimaryDomain(id);
      entity.domain = domain.id;
      entity.lastUpdatedAt = block.id;
      entity.save();
      log.info("Primary domain now for resolvedAddressId {} domain {}", [fromAccount.id, domain.id])
    }
    return entity as PrimaryDomain;
  }

  /**
   * @dev This function gets or creates a air primary domain transaction
   * @param block air block
   * @param transactionHash transaction hash
   * @param domain air domain
   * @param resolvedAddress domain resolved address
   * @param chainId chain id
   * @returns air primary domain transaction
   */
  function getOrCreateAirPrimaryDomainTransaction(
    block: AirBlock,
    transactionHash: string,
    domain: AirDomain,
    resolvedAddress: string,
    chainId: string,
  ): AirPrimaryDomainTransaction {
    let id = ETHEREUM_MAINNET_ID.concat('-').concat(transactionHash);
    let entity = AirPrimaryDomainTransaction.load(id);
    if (entity == null) {
      entity = new AirPrimaryDomainTransaction(id);
      entity.block = block.id;
      entity.transactionHash = transactionHash;
      entity.tokenId = domain.tokenId;
      entity.domain = domain.id;
      entity.index = updateAirEntityCounter(AIR_SET_PRIMARY_DOMAIN_ENTITY_COUNTER_ID, block);
      entity.resolvedAddress = getOrCreateAirAccount(chainId, resolvedAddress, block).id; //make sure to remove the old primary ens if changed
      entity.save();
    }
    return entity as AirPrimaryDomainTransaction;
  }

  /**
   * @dev This function gets or creates a AirAddrChanged entity
   * @param chainId chain id
   * @param logOrCallIndex txn log or index
   * @param resolver resolver contract address
   * @param block air block
   * @param transactionHash transaction hash 
   * @param previousResolvedAddressId air account id of previous resolved address
   * @param newResolvedAddress new resolved address
   * @param domain domain
   * @returns AirAddrChanged entity
   */
  function getOrCreateAirResolvedAddressChanged(
    chainId: string,
    logOrCallIndex: BigInt,
    resolver: AirResolver,
    block: AirBlock,
    transactionHash: string,
    previousResolvedAddressId: string | null,
    newResolvedAddress: string,
    domain: AirDomain,
  ): AirResolvedAddressChanged {
    let id = createEntityId(transactionHash, block.number, logOrCallIndex);
    let entity = AirResolvedAddressChanged.load(id);
    if (entity == null) {
      entity = new AirResolvedAddressChanged(id);
      entity.resolver = resolver.id;
      entity.block = block.id;
      entity.transactionHash = transactionHash;
      entity.previousResolvedAddress = previousResolvedAddressId;
      entity.newResolvedAddress = getOrCreateAirAccount(chainId, newResolvedAddress, block).id;
      entity.domain = domain.id;
      entity.tokenId = domain.tokenId;
      entity.index = updateAirEntityCounter(AIR_ADDR_CHANGED_ENTITY_COUNTER_ID, block);
      entity.save();
    }
    return entity as AirResolvedAddressChanged;
  }

  /**
   * @dev This function creates a resolver entity id
   * @param resolver domain resolver address
   * @param node domain node
   * @returns returns a resolver entity id
   */
  function createResolverEntityId(resolver: string, node: string): string {
    return resolver.concat("-").concat(node);
  }

  /**
   * @dev this is a generic function to create ids for entities
   * @param transactionHash transaction hash
   * @param blockHeight block number in the chain
   * @param logOrCallIndex txn log or call index
   * @returns entity id in string format
   */
  function createEntityId(transactionHash: string, blockHeight: BigInt, logOrCallIndex: BigInt): string {
    return transactionHash.concat("-").concat(blockHeight.toString()).concat('-').concat(logOrCallIndex.toString());
  }

  /**
   * @dev this function needs to be removed
   * @dev this function creates subnode of the node and returns it as air domain entity id
   * @param node takes the node param from the event
   * @param labelHash takes the label param from the event
   * @returns returns a air domain entity id
   */
  function createAirDomainEntityId(node: Bytes, labelHash: Bytes): string {
    let subnode = makeSubnode(node, labelHash);
    return subnode;
  }

  /**
   * @dev this function needs to be removed
   * @dev this function creates subnode of the node and label
   * @param node takes the node param from the event
   * @param labelHash takes the label param from the event
   * @returns returns a subnode in hex string format
   */
  function makeSubnode(node: Bytes, labelHash: Bytes): string {
    return crypto.keccak256(node.concat(labelHash)).toHexString()
  }

  /**
   * @dev this function gets or creates a new AirNameRenewedTransaction entity
   * @param transactionHash transaction hash
   * @param chainId chain id
   * @param block air block
   * @param domain air domain
   * @param cost cost of the transaction
   * @param paymentToken payment token
   * @param renewer renewer address
   * @param expiryTimestamp expiry date of the domain
   * @returns AirNameRenewedTransaction entity
   */
  function getOrCreateAirNameRenewedTransaction(
    transactionHash: string,
    chainId: string,
    block: AirBlock,
    domain: AirDomain,
    cost: BigInt | null,
    paymentToken: string,
    renewer: string,
    expiryTimestamp: BigInt,
  ): AirNameRenewedTransaction {
    let id = transactionHash.concat("-").concat(domain.id);
    let entity = AirNameRenewedTransaction.load(id);
    if (entity == null) {
      entity = new AirNameRenewedTransaction(id);
      entity.block = block.id;
      entity.transactionHash = transactionHash;
      entity.tokenId = domain.tokenId;
      entity.domain = domain.id;
      entity.cost = cost;
      entity.index = updateAirEntityCounter(AIR_NAME_RENEWED_ENTITY_COUNTER_ID, block);
      if (paymentToken) {
        entity.paymentToken = getOrCreateAirToken(chainId, paymentToken).id;
      }
      entity.renewer = getOrCreateAirAccount(chainId, renewer, block).id;
      entity.expiryTimestamp = expiryTimestamp;
      entity.save();
    }
    // getting renewal events from 2 contracts, old contract gives cost, new contract gives null, so if old contract event is processed first, then we update the cost
    // if new contract event is processed first, then we don't update the cost
    if (cost && !entity.cost) {
      entity.cost = cost;
      entity.save();
    }
    return entity as AirNameRenewedTransaction;
  }

  /**
   * @dev this function gets or creates an AirNameRegisteredTransaction entity
   * @param chainId chain id
   * @param blockHeight block height
   * @param blockHash block hash
   * @param blockTimestamp block timestamp
   * @param transactionHash transaction hash
   * @param logOrCallIndex txn log or call index
   * @param domain air domain
   * @param cost cost of the transaction
   * @param paymentToken payment token - can be null
   * @param registrant registrant address
   * @param expiryTimestamp expiry date of the domain
   * @returns returns an AirNameRegisteredTransaction entity
   */
  function getOrCreateAirNameRegisteredTransaction(
    chainId: string,
    blockHeight: BigInt,
    blockHash: string,
    blockTimestamp: BigInt,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domain: AirDomain,
    cost: BigInt | null,
    paymentToken: string,
    registrant: string,
    expiryTimestamp: BigInt,
  ): AirNameRegisteredTransaction {
    let block = getOrCreateAirBlock(chainId, blockHeight, blockHash, blockTimestamp);
    let id = createEntityId(transactionHash, block.number, logOrCallIndex);
    let entity = AirNameRegisteredTransaction.load(id);
    if (entity == null) {
      entity = new AirNameRegisteredTransaction(id);
      entity.block = block.id;
      entity.transactionHash = transactionHash;
      entity.tokenId = domain.tokenId;
      entity.domain = domain.id;
      entity.index = updateAirEntityCounter(AIR_NAME_REGISTERED_ENTITY_COUNTER_ID, block);
      entity.cost = cost;
      if (paymentToken) {
        entity.paymentToken = getOrCreateAirToken(chainId, paymentToken).id;
      }
      entity.registrant = getOrCreateAirAccount(chainId, registrant, block).id;
      entity.expiryTimestamp = expiryTimestamp;
      entity.save();
    }
    return entity as AirNameRegisteredTransaction;
  }

  /**
   * @dev this function gets or creates an AirResolver entity
   * @param domain air domain entity
   * @param chainId chain id
   * @param block air block
   * @param resolver resolver contract address
   * @param resolvedAddress address of resolved address or null
   * @returns AirResolver entity
   */
  function getOrCreateAirResolver(
    domain: AirDomain,
    chainId: string,
    block: AirBlock,
    resolver: string,
    resolvedAddress: string | null = EMPTY_STRING,
  ): AirResolver {
    let id = createResolverEntityId(resolver, domain.id);
    let entity = AirResolver.load(id);
    if (entity == null) {
      entity = new AirResolver(id);
      entity.address = getOrCreateAirAccount(chainId, resolver, block).id;
      entity.domain = domain.id;
    }
    if (resolvedAddress && resolvedAddress != EMPTY_STRING) {
      entity.resolvedAddress = getOrCreateAirAccount(chainId, resolvedAddress, block).id;
    } else if (resolvedAddress == null) {
      entity.resolvedAddress = null;
    }
    entity.save();
    return entity as AirResolver;
  }

  /**
   * @dev This function gets or creates a new AirDomainNewTTLTransaction entity
   * @param transactionHash transaction hash
   * @param blockHeight block number in the chain
   * @param logOrCallIndex txn log or call index
   * @param oldTTL old ttl value - can be null
   * @param newTTL new ttl value
   * @param block air block object
   * @param domain air domain object
   * @returns returns a air domain new ttl transaction entity
   */
  function getOrCreateAirDomainNewTTLTransaction(
    transactionHash: string,
    blockHeight: BigInt,
    logOrCallIndex: BigInt,
    oldTTL: BigInt | null,
    newTTL: BigInt,
    block: AirBlock,
    domain: AirDomain,
  ): AirDomainNewTTLTransaction {
    let id = createEntityId(transactionHash, blockHeight, logOrCallIndex);
    let entity = AirDomainNewTTLTransaction.load(id);
    if (entity == null) {
      entity = new AirDomainNewTTLTransaction(id);
      entity.oldTTL = oldTTL;
      entity.transactionHash = transactionHash;
      entity.newTTL = newTTL;
      entity.block = block.id;
      entity.tokenId = domain.tokenId;
      entity.domain = domain.id;
      entity.index = updateAirEntityCounter(AIR_DOMAIN_NEW_TTL_ENTITY_COUNTER_ID, block);
      entity.save();
    }
    return entity as AirDomainNewTTLTransaction;
  }

  /**
   * @dev this function gets or creates a new AirDomainNewResolverTransaction entity
   * @param previousResolverId previous resolver Id - can be null
   * @param newResolverId new resolver Id
   * @param block air block entity
   * @param transactionHash transaction hash
   * @param logOrCallIndex txn log or call index
   * @param domain air domain entity
   * @returns AirDomainNewResolverTransaction entity
   */
  function getOrCreateAirDomainNewResolverTransaction(
    previousResolverId: string | null,
    newResolverId: string,
    block: AirBlock,
    transactionHash: string,
    logOrCallIndex: BigInt,
    domain: AirDomain,
  ): AirDomainNewResolverTransaction {
    let id = createEntityId(transactionHash, block.number, logOrCallIndex);
    let entity = AirDomainNewResolverTransaction.load(id);
    if (entity == null) {
      entity = new AirDomainNewResolverTransaction(id);
      entity.previousResolver = previousResolverId;
      entity.newOwnerResolver = newResolverId;
      entity.block = block.id;
      entity.transactionHash = transactionHash;
      entity.tokenId = domain.tokenId;
      entity.domain = domain.id;
      entity.index = updateAirEntityCounter(AIR_DOMAIN_NEW_RESOLVER_ENTITY_COUNTER_ID, block);
      entity.save();
    }
    return entity as AirDomainNewResolverTransaction;
  }

  /**
   * @dev this function creates a new reverse registrar entity if it does not exist
   * @param name ens name, ex: 'schiller.eth'
   * @param domainId air domain id
   * @param block air block entity
   * @returns ReverseRegistrar entity
   */
  function createReverseRegistrar(
    name: string,
    domainId: string,
    block: AirBlock,
  ): ReverseRegistrar {
    let id = crypto.keccak256(Bytes.fromUTF8(name)).toHexString();
    let entity = ReverseRegistrar.load(id);
    if (entity == null) {
      entity = new ReverseRegistrar(id);
      entity.name = name;
      entity.domain = domainId;
      entity.createdAt = block.id;
      entity.save();
    }
    return entity as ReverseRegistrar;
  }

  /**
   * @dev this function gets a reverse registrar entity
   * @param name ens name, ex: 'schiller.eth'
   * @returns ReverseRegistrar entity
   */
  function getReverseRegistrar(
    name: string,
  ): ReverseRegistrar | null {
    let id = crypto.keccak256(Bytes.fromUTF8(name)).toHexString();
    return ReverseRegistrar.load(id);
  }

  /**
   * @dev this function gets or creates a new air domain entity
   * @param domain Domain class object
   * @returns AirDomain entity
   */
  function getOrCreateAirDomain(
    domain: Domain,
  ): AirDomain {
    let entity = AirDomain.load(domain.id);
    if (entity == null) {
      entity = new AirDomain(domain.id);
      entity.subdomainCount = BIG_INT_ZERO;
      entity.owner = getOrCreateAirAccount(domain.chainId, ZERO_ADDRESS, domain.block).id;
      entity.tokenAddress = getOrCreateAirToken(domain.chainId, domain.tokenAddress).id;
      entity.isPrimary = false;
      entity.expiryTimestamp = BIG_INT_ZERO;
      entity.registrationCost = BIG_INT_ZERO;
      entity.createdAt = domain.block.id;
      entity.lastBlock = domain.block.id;
      entity.save();
    }
    return entity as AirDomain;
  }

  /**
   * @dev this function gets a air domain entity
   * @param domainId air domain entity id
   * @returns AirDomain entity - null if entity does not exist
  */
  export function getAirDomain(
    domainId: string,
  ): AirDomain | null {
    return AirDomain.load(domainId);
  }

  /**
   * @dev this function gets or creates a new air domain owner changed transaction entity
   * @param block air block entity
   * @param logOrCallIndex log or call index
   * @param chainId chain id
   * @param previousOwnerId previous owner id
   * @param newOwner new owner address
   * @param transactionHash transaction hash
   * @param tokenId token id
   * @param domain air domain
   * @returns AirDomainOwnerChangedTransaction entity
   */
  function getOrCreateAirDomainOwnerChangedTransaction(
    block: AirBlock,
    logOrCallIndex: BigInt,
    chainId: string,
    previousOwnerId: string,
    newOwner: string,
    transactionHash: string,
    tokenId: string,
    domain: AirDomain,
  ): AirDomainOwnerChangedTransaction {
    let id = createEntityId(transactionHash, block.number, logOrCallIndex);
    let entity = AirDomainOwnerChangedTransaction.load(id);
    if (entity == null) {
      entity = new AirDomainOwnerChangedTransaction(id);
      entity.previousOwner = previousOwnerId;
      entity.newOwner = getOrCreateAirAccount(chainId, newOwner, block).id;
      entity.transactionHash = transactionHash;
      entity.tokenId = tokenId;
      entity.domain = domain.id;
      entity.block = block.id;
      entity.index = updateAirEntityCounter(AIR_DOMAIN_OWNER_CHANGED_ENTITY_COUNTER_ID, block);
      entity.save();
    }
    return entity as AirDomainOwnerChangedTransaction;
  }

  /**
   * @dev this function does a recursive subdomain count decrement
   * @param domain air domain entity
   * @param chainId chain id
   * @param block air block entity
   * @param tokenAddress contract address of nft token
   * @returns air domain entity id
   */
  function recurseSubdomainCountDecrement(domain: AirDomain, chainId: string, block: AirBlock, tokenAddress: string): string | null {
    if ((domain.resolver == null || domain.resolver!.split("-")[0] == ZERO_ADDRESS) &&
      domain.owner == getOrCreateAirAccount(chainId, ZERO_ADDRESS, block).id && domain.subdomainCount == BIG_INT_ZERO) {
      if (domain.parent) {
        const parentDomain = getOrCreateAirDomain(new Domain(domain.parent!, chainId, block, tokenAddress));
        if (parentDomain) {
          parentDomain.subdomainCount = parentDomain.subdomainCount.minus(BIGINT_ONE)
          parentDomain.lastBlock = block.id;
          parentDomain.save();
          return recurseSubdomainCountDecrement(parentDomain, chainId, block, tokenAddress)
        }
      }
      return null
    }
    return domain.id
  }

  /**
   * @dev this function gets or creates a new air token entity
   * @param chainID chain id
   * @param address token address
   * @returns AirToken entity
   */
  function getOrCreateAirToken(chainID: string, address: string): AirToken {
    let entity = AirToken.load(chainID + "-" + address);
    if (entity == null) {
      entity = new AirToken(chainID + "-" + address);
      entity.address = address;
      entity.save();
    }
    return entity as AirToken;
  }

  /**
   * @dev this class has all fields required to create a domain entity
   * @param id domain id
   * @param chainId chain id
   * @param block air block entity
   * @param tokenAddress token address of domain nft token contract
   */
  export class Domain {
    constructor(
      public id: string,
      public chainId: string,
      public block: AirBlock,
      public tokenAddress: string,
    ) { }
  }
}