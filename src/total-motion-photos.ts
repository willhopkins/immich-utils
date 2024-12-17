import { init, searchAssets } from '@immich/sdk'

const apiKey = process.env.IMMICH_API_KEY
const baseUrl = process.env.IMMICH_BASE_URL

if (!apiKey || !baseUrl) {
    throw new Error('Missing IMMICH_API_KEY or IMMICH_BASE_URL environment variables')
}

init({ apiKey, baseUrl })

async function* getMotionPhotoIds(): AsyncGenerator<string[]> {
    let nextPage: string | null = '1'
    let totalFound = 0

    do {
        try {
            const response = await searchAssets({
                metadataSearchDto: { isMotion: true, page: parseInt(nextPage) },
            })

            const assets = response.assets.items
            if (assets && assets.length > 0) {
                const motionPhotoIds = assets.map((asset: { id: string }) => asset.id)
                totalFound += motionPhotoIds.length
                console.log(`Running total of motion photos found [${totalFound}]`)
                yield motionPhotoIds
            }

            nextPage = response.assets.nextPage
        } catch (error) {
            console.error(`Failed searching for motion photos with error [${error}]`)
            break
        }
    } while (nextPage)
}

void (async () => {
    console.log('Starting search for motion photos...')

    const startTime = Date.now()
    let totalMotionPhotos = 0

    for await (const motionPhotoIds of getMotionPhotoIds()) {
        console.log(`Found [${motionPhotoIds.length}] motion photos in this batch`)
        totalMotionPhotos += motionPhotoIds.length
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('--- Report ---')
    console.log(`Total motion photos found: [${totalMotionPhotos}]`)
    console.log(`Elapsed time: [${elapsedTime}] seconds`)
    console.log('Search completed successfully')
})()
