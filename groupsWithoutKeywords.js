function main() {
  var adgroupIter = AdWordsApp.adGroups()
    .withCondition('CampaignStatus = ENABLED')
    .withCondition("AdvertisingChannelType = SEARCH")
    .withCondition('Status = ENABLED')
    .get();
  var labelNameForKeywords = 'empty_group_ads'; //предварительно необходимо создать ярлык в аккаунте с именем 'empty_group_ads'
  var emptyAdgroupIter = 0;
  while (adgroupIter.hasNext()) {
    var adgroup = adgroupIter.next();
    var keywordIter = adgroup.keywords()
      .withCondition("Status = ENABLED")
      .get();
    var hasAds = keywordIter.hasNext();
    if (!hasAds) {
      adgroup.applyLabel(labelNameForKeywords);
      emptyAdgroupIter++;
    }
  }
  if (emptyAdgroupIter == 0) {
    Logger.log('All right');
  } else {
    Logger.log(emptyAdgroupIter);
  }
}