const schema = `#--Airstack Schemas--

enum AirProtocolType {
  GENERIC
  EXCHANGE
  LENDING
  YIELD
  BRIDGE
  DAO
  NFT_MARKET_PLACE
  STAKING
  P2E #play to earn
  LAUNCHPAD
}

enum AirProtocolActionType {
  ALL ##to track all action stats of a dapp
  ### NFT Marketplace/Tokens ###
  BUY
  SELL
  MINT
  BURN # TODO check this later
  ### NFT (ex: Poap) ###
  ATTEND
  ### P2E (NFT + Utility) ###
  EARN
  ### DEX ###
  SWAP
  ADD_LIQUIDITY
  REMOVE_LIQUIDITY
  ADD_TO_FARM
  REMOVE_FROM_FARM
  CLAIM_FARM_REWARD
  ### Lending ###
  LEND
  BORROW
  FLASH_LOAN
  ### Staking / Delegating ###
  STAKE
  RESTAKE
  UNSTAKE
  DELEGATE
  CLAIM_REWARDS
}


type AirBlock @entity {
 id: ID! #chainID-number
 hash: String!
 number: BigInt!
 timestamp: BigInt!
}

type AirMeta @entity {
  id: ID! # air_meta 
  network: String!
  schemaVersion: String!
  slug: String! #Opensea_V1
  name: String! # Opeasea/Rarible
  version: String! #Seaport/Exchange V1
}

type AirEntityCounter @entity {
	id: ID! #Air_DAILY_STATS_ACCOUNT
	count: BigInt!
	createdAt: AirBlock! 
	lastUpdatedAt: AirBlock!
}

type AirAccount @entity {
  id: ID!
  address: String!
	createdAt: AirBlock! 
}

type AirToken @entity {
	id: ID! #chain-address
  address: String!
}

interface AirTransaction {
	id: ID ! #chain-hash-logIndex-< add as per context > NFT marketplace will have tokenId
  from: AirAccount!
  to: AirAccount!
  hash: String!
  block: AirBlock!
  index: BigInt!
  protocolType: AirProtocolType!
  protocolActionType: AirProtocolActionType!
}

type AirNFT @entity {
  id: ID! #AirNftTransaction(ID)-tokenAddress-TokenID
  tokenAddress: AirToken!
  tokenId: String!
  tokenAmount:BigInt!
}

enum AirNFTSaleType {
 SINGLE_ITEM_SALE
 BUNDLE_SALE
}

type AirNftTransaction implements AirTransaction @entity {
  id: ID!   #chainId-txHash-logOrCallIndex
  from: AirAccount!
  to: AirAccount!
  hash: String!
  block: AirBlock!
  index: BigInt!
  protocolType: AirProtocolType!
  protocolActionType: AirProtocolActionType!
  nfts: [AirNFT!]!
  saleType: AirNFTSaleType!
	paymentToken: AirToken! #payment
  paymentAmount: BigInt! #payment
  royalties: [AirNftSaleRoyalty!] @derivedFrom(field: "nftTransaction")
  feeAmount: BigInt!
  feeBeneficiary: AirAccount!
  extraData: AirExtraData
}

type AirNftSaleRoyalty @entity{
  id: ID! #AirNftTransaction(ID)-royalty beneficiary-amount
  amount: BigInt!
  beneficiary: AirAccount!
  nftTransaction: AirNftTransaction!
}

type AirExtraData @entity {
  id: ID!
  name: String!
  value: String!
}
`

export default schema;
