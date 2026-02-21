import { Input, BlobSource, VideoSampleSink, ALL_FORMATS } from 'mediabunny'
import { readFileSync, openSync } from 'fs'

async function run() {
  const fileData = readFileSync('./public/favicon.ico') // Let's try to mock something, or... wait...
  // I need a real video file to test mediabunny locally in node!
}
run()
