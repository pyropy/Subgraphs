import * as airstack from "../modules/airstack/domain-name";
import {
  AddrChanged as AddrChangedEvent,
  VersionChanged as VersionChangedEvent,
} from "../generated/Resolver/Resolver";
import { log } from "@graphprotocol/graph-ts";
import { ETHEREUM_MAINNET_ID } from "../modules/airstack/domain-name/utils";
import { TOKEN_ADDRESS_ENS } from "./utils";
/**
 * @dev this function maps the AddrChanged event from the Resolver contract
 * @param event AddrChangedEvent from Resolver contract
 */
export function handleAddrChanged(event: AddrChangedEvent): void {
  log.info("handleAddrChanged: node {} addr {} resolver {} txhash {}", [event.params.node.toHexString(), event.params.a.toHexString(), event.address.toHexString(), event.transaction.hash.toHexString()]);
  airstack.domain.trackAddrChangedTransaction(
    ETHEREUM_MAINNET_ID,
    event.logIndex,
    event.address.toHexString(),
    event.params.a.toHexString(),
    event.params.node.toHexString(),
    event.block.number,
    event.block.hash.toHexString(),
    event.block.timestamp,
    event.transaction.hash,
    TOKEN_ADDRESS_ENS,
  );
}

/**
 * @dev this function maps the VersionChanged event from the Resolver contract
 * @param event VersionChangedEvent from Resolver contract
 */
export function handleVersionChanged(event: VersionChangedEvent): void {
  log.info("handleVersionChanged: node {} resolver {} txhash {}", [event.params.node.toHexString(), event.address.toHexString(), event.transaction.hash.toHexString()]);
  airstack.domain.trackResolverVersionChange(
    ETHEREUM_MAINNET_ID,
    event.block.number,
    event.block.hash.toHexString(),
    event.block.timestamp,
    event.params.node.toHexString(),
    event.address.toHexString(),
    TOKEN_ADDRESS_ENS,
  );
}
