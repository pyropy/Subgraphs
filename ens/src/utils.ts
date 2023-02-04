export const TOKEN_ADDRESS_ENS = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
import {
  DomainVsIsMigratedMapping,
  ReverseRegistrar,
} from "../generated/schema";
import {
  Bytes,
  crypto,
  ethereum,
} from "@graphprotocol/graph-ts";
/**
 * @dev this function creates a new DomainVsIsMigratedMapping entity
 * @param domaiId air domain entity id
 * @param chainId chain id
 * @param blockNumber block number
 * @param isMigrated is migrated flag - only required when creating a new entity
 * @returns DomainVsIsMigratedMapping entity
*/
export function getOrCreateIsMigratedMapping(domainId: string, chainId: string, blockNumber: string, isMigrated: boolean = false): DomainVsIsMigratedMapping {
  let blockId = chainId.concat("-").concat(blockNumber);
  let entity = DomainVsIsMigratedMapping.load(domainId);
  if (entity == null) {
    entity = new DomainVsIsMigratedMapping(domainId);
    entity.isMigrated = isMigrated;
    entity.lastUpdatedAt = blockId;
    entity.save();
  }
  return entity as DomainVsIsMigratedMapping;
}

/**
 * @dev this function creates subnode of the node and returns it as air domain entity id
 * @param node takes the node param from the event
 * @param label takes the label param from the event
 * @returns returns a air domain entity id
 */
export function createAirDomainEntityId(node: Bytes, label: Bytes): string {
  return crypto.keccak256(node.concat(label)).toHexString()
}

/**
 * @dev this function creates a new reverse registrar entity if it does not exist
 * @param name ens name, ex: 'schiller.eth'
 * @param domainId air domain id
 * @param block air block entity
 * @returns ReverseRegistrar entity
 */
export function createReverseRegistrar(
  name: string,
  domainId: string,
  chainId: string,
  block: ethereum.Block,
): ReverseRegistrar {
  let id = crypto.keccak256(Bytes.fromUTF8(name)).toHexString();
  let entity = ReverseRegistrar.load(id);
  if (entity == null) {
    entity = new ReverseRegistrar(id);
    entity.name = name;
    entity.domain = domainId;
    entity.createdAt = chainId.concat("-").concat(block.number.toString());
    entity.save();
  }
  return entity as ReverseRegistrar;
}
