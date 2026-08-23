import landing from './landing'
import common from './common'
import dashboard from './dashboard'
import channelMonitorV2 from './channelMonitorV2'
import batchImage from './batchImage'
import codexGuide from './codexGuide'
import admin from './admin'
import misc from './misc'
import playground from './playground'
import imagePlayground from './imagePlayground'

export default {
  ...landing,
  ...common,
  ...dashboard,
  ...channelMonitorV2,
  ...batchImage,
  ...codexGuide,
  admin,
  ...misc,
  ...playground,
  ...imagePlayground,
}
