var EXCLUDED_PLACEMENT_LIST_NAME = "CleanerRemarketing";

function main() {

    labelNames = "CleanerRemarketing"; //Ярлык кампаний, которые участвуют в анализе
    var hypeCtr = 6; //Площадки с CTR больше hypeCtr отключаются
    var hypeImpressions = 100; //при числе показов не менее hypeImpressions
    var lowCtr = 0.05; ////Площадки с CTR меньше lowCtr отключаются
    var lowImpressions = 2000; //при числе показов не менее lowImpressions 
    var clicksLimit = 100; //Предельное число кликов. Если кликов больше этого числа и нет конверсий, то площадка исключается
    //var ignoreAnonymous = 1; //Игнорировать anonymous.google, 0 будет исключать
    //var ignorePlacements = 1; //Игнорировать список ваших площадок, 0 будет исключать
    var exclude = ['avito.ru', 'youtube.com']; //Список площадок для исключения
    var limitCpa = 8000; //Исключаем по стоимости CPA
    var during = "LAST_30_DAYS"; //Период сбора данных

    //TODAY | YESTERDAY | LAST_7_DAYS | THIS_WEEK_SUN_TODAY | THIS_WEEK_MON_TODAY | LAST_WEEK |
    //LAST_14_DAYS | LAST_30_DAYS | LAST_BUSINESS_WEEK | LAST_WEEK_SUN_SAT | THIS_MONTH


    var campaignArray = [];
    var excludePlacementArray = [];
    var campaigns = "";
    var campaignSelector = AdWordsApp
        .campaigns()
        .withCondition("LabelNames CONTAINS_ANY ['" + labelNames + "']");

    var campaignIterator = campaignSelector.get();
    while (campaignIterator.hasNext()) {
        campaignArray.push("'" + campaignIterator.next().getName() + "'");
    }

    campaigns = campaignArray.join(',');
    Logger.log("Campaigns: " + campaigns);


    var report = AdWordsApp.report("SELECT Domain, Clicks, Impressions, Ctr, Conversions, Cost, CostPerConversion " +
        "FROM AUTOMATIC_PLACEMENTS_PERFORMANCE_REPORT " +
        "WHERE CampaignName IN [" + campaigns + "] " +
        "DURING " + during);
    var rows = report.rows();
    while (rows.hasNext()) {
        var row = rows.next();
        var domain = row['Domain'];
        var clicks = row['Clicks'];
        var impressions = row['Impressions'];
        var сonversions = row['Conversions'];
        var ctr = row['Ctr'];
        var cost = row['Cost'];
        var costPerConversion = row['CostPerConversion'];
        costPerConversion = parseInt(costPerConversion.replace(",", ""));
        cost = parseInt(cost.replace(",", ""));

        // if (ignoreAnonymous && domain.toString()=="anonymous.google") continue;
        // if (ignorePlacements && domain.toString()=="avito.ru" || domain.toString()=="youtube.com") continue;

        if (domain.indexOf("mobileapp") == 0) domain = domain.replace(/mobileapp::\d+-/, "") + ".adsenseformobileapps.com";

        if (containsAny(domain.toString(), exclude)) {
            excludePlacementArray[excludePlacementArray.length] == domain.toString();
            continue;
        }
        
        //HYPE
        if ((clicks / impressions * 100 >= hypeCtr) && (impressions >= hypeImpressions) && (сonversions < 1)) {
            excludePlacementArray.push(domain.toString());
            Logger.log('Excluded (Hype CTR): ' + domain.toString());
        }
        //LOWER
        if ((clicks / impressions * 100 <= lowCtr) && (impressions >= lowImpressions) && (сonversions < 1)) {
            excludePlacementArray.push(domain.toString());
            Logger.log('Excluded (Lower CTR): ' + domain.toString());
        }
        //LIMIT CLICK WITHOUT CONVERSION
        if ((clicks > clicksLimit) && (сonversions < 1)) {
            excludePlacementArray.push(domain.toString());
            Logger.log('Excluded (Limit click): ' + domain.toString());
        }
        //2xCPA
        if ((cost > limitCpa) && (сonversions == 0) || (costPerConversion > limitCpa)) {
            excludePlacementArray.push(domain.toString());
          Logger.log('Excluded (Cost per conversion limit): Conversions: ' + сonversions + ', Cost: ' + cost + ', CPA: ' + costPerConversion + ', ' + domain.toString());
        }
    }

    addNegativeKeywordToList(excludePlacementArray);

}

function containsAny(str, substrings) {
    for (var i = 0; i != substrings.length; i++) {
        var substring = substrings[i];
        if (str.indexOf(substring) != -1) {
            return substring;
        }
    }
    return null;
}


function addNegativeKeywordToList(negativePlacements) {
    var excludedPlacementListIterator =
        AdWordsApp.excludedPlacementLists().withCondition("Name = '" + EXCLUDED_PLACEMENT_LIST_NAME + "'").get();

    if (excludedPlacementListIterator.totalNumEntities() == 1) {
        var excludedPlacementList = excludedPlacementListIterator.next().addExcludedPlacements(negativePlacements);
    } else {
        AdWordsApp.newExcludedPlacementListBuilder()
            .withName(EXCLUDED_PLACEMENT_LIST_NAME)
            .build().getResult().addExcludedPlacements(negativePlacements);
    }
}