require('dotenv').config();
const fetch = require('cross-fetch');
const ethers = require('ethers');
const fs = require('fs');

const options = {
	method: 'GET',
	headers: { accept: 'application/json', 'x-api-key': process.env.OPENSEA_API_KEY },
};

async function getOpenSeaOffers(slug) {
	const url = `https://api.opensea.io/api/v2/listings/collection/${slug}/all`;
	const response = await fetch(url, options);
	const data = await response.json();
	return data;
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length != 1) {
		console.log('Usage: node getOpenSeaOffers.js <collection-slug>');
		console.log('Example: node getOpenSeaOffers.js captain-company-ships');
		return;
	}

	const collectionSlug = args[0];

	const data = await getOpenSeaOffers(collectionSlug);

	const listingDataList = [];
	for (const listing of data.listings) {
		const listingData = new Listing(
			listing.order_hash,
			listing.protocol_data.parameters.offer[0].token,
			listing.protocol_data.parameters.offer[0].identifierOrCriteria,
			ethers.formatUnits(listing.price.current.value, listing.price.current.decimals),
			listing.price.current.currency,
			listing.protocol_data.parameters.offerer,
			listing.protocol_data.parameters.startTime,
			listing.protocol_data.parameters.endTime,
		);

		listingDataList.push(listingData);
	}

	// sort by the price high to low
	listingDataList.sort((a, b) => b.price - a.price);

	const output = listingDataList.map((listing) => listing.toCSV()).join('\n');
	console.log(listingDataList[0].getCSVHeader());
	console.log(output);
	console.log(`Total listings: ${listingDataList.length}`);

	const startTime = new Date();
	const timestamp = startTime.toISOString().split('.')[0].replaceAll(':', '-');
	let filename = `./output/AllListings-${collectionSlug}-${timestamp}.csv`;

	fs.writeFileSync(filename, listingDataList[0].getCSVHeader() + '\n' + output);

	// create a summarised list of seller by count of listings
	const sellerList = {};
	listingDataList.forEach((listing) => {
		if (sellerList[listing.seller]) {
			sellerList[listing.seller]++;
		}
		else {
			sellerList[listing.seller] = 1;
		}
	});

	// sort by the count of listings
	const sellerListSorted = Object.entries(sellerList).sort((a, b) => b[1] - a[1]);

	console.log('Seller,Count');
	sellerListSorted.forEach((seller) => console.log(`${seller[0]},${seller[1]}`));

	filename = `./output/GroupedBySellerCount-${collectionSlug}-${timestamp}.csv`;

	fs.writeFileSync(filename, 'Seller,Count\n' + sellerListSorted.map((seller) => `${seller[0]},${seller[1]}`).join('\n'));

}

class Listing {
	constructor(id, tokenAddress, tokenId, price, token, seller, listingTime, expirationTime) {
		this.id = id;
		this.tokenAddress = tokenAddress;
		this.tokenId = tokenId;
		this.price = price;
		this.token = token;
		this.seller = seller;
		this.listingTime = listingTime * 1000;
		this.expirationTime = expirationTime * 1000;
	}

	getCSVHeader() {
		return 'seller,price,id,tokenAddress,tokenId,listingTime,expirationTime';
	}

	toCSV() {
		return `${this.seller},${this.price},${this.token},${this.id},${this.tokenAddress},${this.tokenId},${new Date(this.listingTime).toISOString()},${new Date(this.expirationTime).toISOString()}`;
	}
}

main().then(() => console.log('Done')).catch((error) => console.error(error));