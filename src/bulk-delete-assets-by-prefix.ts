/* eslint-disable no-inline-comments */
import { config } from 'dotenv'
import { deleteAssets, init, searchAssets } from '@immich/sdk'

// Load environment variables from .env file
config()

const apiKey = process.env.IMMICH_API_KEY // Get API key from environment variables
const baseUrl = process.env.IMMICH_BASE_URL // Get base URL from environment variables
const dryRun = process.env.IMMICH_DRY_RUN !== 'false' // Set to false to actually delete assets
const deleteLimit = null // Set a limit for the number of assets to delete (set to null for no limit) – This is nice for a test run with limited impact

if (!apiKey || !baseUrl) {
	throw new Error('Missing IMMICH_API_KEY or IMMICH_BASE_URL environment variables')
}

init({ apiKey, baseUrl })

if (dryRun) {
    console.warn('Running in dry run mode.')
}

async function deleteAssetsByIds(assetIds: string[]): Promise<number> {
	const batch = deleteLimit ? assetIds.slice(0, deleteLimit) : assetIds

	if (dryRun) {
		console.log(`DRY RUN: Would delete asset IDs [${batch.join(', ')}]`)

		return 0
	}

	await deleteAssets({ assetBulkDeleteDto: { force: true, ids: batch } })
	console.warn(`Deleted asset IDs [${batch.join(', ')}]`)

	return batch.length
}

async function* searchAssetsByFilenamePrefix(prefix: string): AsyncGenerator<string[]> {
	let nextPage: null | string = '1'
	let runningTotal = 0
	do {
		try {
			const response = await searchAssets({
				metadataSearchDto: { 
					page: parseInt(nextPage),
					originalFileName: prefix 
				},
			})

			const assets = response.assets.items
			if (assets && assets.length > 0) {
				const matchingAssetIds = assets
					.filter((asset: { originalFileName: string }) => {
						const matches = asset.originalFileName.toLowerCase().startsWith(prefix.toLowerCase()) && 
							asset.originalFileName.toLowerCase().includes('thumb')
						if (matches) {
							console.log(`Found matching thumbnail asset: ${asset.originalFileName}`)
						}
						return matches
					})
					.map((asset: { id: string }) => asset.id)
				
				if (matchingAssetIds.length > 0) {
					runningTotal += matchingAssetIds.length
					console.log(`Running total of matching assets found: [${runningTotal}]`)
				}
				yield matchingAssetIds
			}
			nextPage = response.assets.nextPage
		} catch (error) {
			console.error(`Error while searching for assets with prefix [${prefix}], error [${error}]`)
			break
		}
	} while (nextPage)
}

void (async () => {
	const prefix = 'SYNOPHOTO'
	console.log(`Starting search for assets with filename prefix [${prefix}]`)

	const startTime = Date.now()
	let totalFound = 0
	let totalDeleted = 0

	for await (const assetIds of searchAssetsByFilenamePrefix(prefix)) {
		if (assetIds.length === 0) {
			console.log('No matching assets found in the current batch')
			continue
		}

		console.log(`Found matching assets [${assetIds.length}] in this batch, proceeding to process`)
		totalFound += assetIds.length

		const deletedCount = await deleteAssetsByIds(assetIds)
		totalDeleted += deletedCount

		console.log(`Total assets deleted so far: [${totalDeleted}]`)

		if (deleteLimit && totalDeleted >= deleteLimit) {
			console.log(`Reached deletion limit [${deleteLimit}], ending process early`)
			break
		}
	}

	const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
	console.log('--- Report ---')
	console.log(`Total assets found [${totalFound}]`)
	console.log(`Total assets deleted [${totalDeleted}]`)
	console.log(`Elapsed time [${elapsedTime}] seconds`)
	console.log('Process completed successfully')
})()
