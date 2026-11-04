# Hotel description correction — exact proposed changes

Production read-only preview, 2026-11-04 (project ugekpmogiecfsmydyjxr). Each row below currently has an **empty** Arabic description and this whole bilingual text in the English field. The correction splits it: the Arabic part goes into the Arabic field, the English part stays in the English field. Wording is unchanged; only the heading labels ("English Description", "الوصف العربي المقترح") and blank lines between the halves are dropped.

Script: `supabase/maintenance/2026-11-cleanup/descriptions_fix.sql` (dry run on production: `RESULT DRY: would split 18 row(s)`).

## 1. 4s hotel (a6b57434…)

Split at: paragraph boundary (no heading)

**New Arabic description (description_ar)**

> يقدم فندق 4S دهب تجربة إقامة مريحة ومناسبة للعائلات والأسر، حيث يجمع بين الأجواء الهادئة والمرافق الترفيهية التي تناسب الكبار والأطفال. يضم الفندق حمامات سباحة خارجية ومسبحاً مخصصاً للأطفال، بالإضافة إلى وحدات إقامة عائلية توفر مساحات مريحة وبعضها مجهز بمطبخ صغير وثلاجة وبلكونة.
> 
> كما يوفر الفندق مطعماً لتناول الوجبات، ومساحات للاسترخاء والجلوس، إلى جانب مجموعة من الأنشطة الترفيهية. ويتميز بموقعه في منطقة المشربة بدهب، بالقرب من الممشى السياحي والمطاعم والكافيهات، ليكون اختياراً مناسباً للعائلات والأزواج والباحثين عن إقامة تجمع بين الراحة والترفيه.

**English description after the split (description_en)**

> 4S Hotel Dahab offers a comfortable and relaxing stay, making it a suitable choice for families and travelers with children. The hotel features outdoor swimming pools, including a children's pool, as well as family accommodation options. Some units offer additional conveniences such as kitchenettes, refrigerators, and balconies.
> 
> Guests can also enjoy the on-site restaurant, relaxing outdoor spaces, and recreational activities. Located in the El Mashraba area of Dahab, the hotel provides convenient access to the tourist promenade, local restaurants, and cafés, making it a suitable destination for families, couples, and travelers looking for a comfortable and enjoyable stay.

## 2. ayana studios (21ea47b0…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع أيانا ستوديوز في مدينة دهب، ويوفر وحدات إقامة بنظام الاستوديوهات، مناسبة للأفراد والأزواج والباحثين عن إقامة توفر لهم الخصوصية والراحة. تتميز الاستوديوهات بمساحات عملية وتجهيزات تساعد النزلاء على الاستمتاع بإقامة مريحة ومستقلة، مع سهولة الوصول إلى المناطق السياحية والخدمات المختلفة في دهب.

**English description after the split (description_en)**

> Ayana Studios is located in Dahab and offers studio-style accommodation, ideal for individuals and couples seeking privacy and comfort. The studios provide practical living spaces and convenient amenities for an independent and relaxing stay, with access to Dahab's tourist areas and local services.

## 3. coral reef hotel (e0015379…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق كورال ريف في مدينة دهب بشارع توفيق الحكيم، في موقع يتيح للنزلاء استكشاف أجواء المدينة والتعرف على معالمها ومناطقها السياحية. كما يمكن للزوار الاستمتاع بالمطاعم والكافيهات والتجارب البحرية والأنشطة المختلفة التي تشتهر بها دهب.

**English description after the split (description_en)**

> Coral Reef Hotel is located on Tawfik El Hakim Street in Dahab, offering guests a convenient base to explore the city's attractions and local atmosphere. Visitors can enjoy Dahab's restaurants, cafés, marine experiences, and various activities that make this coastal destination special.

## 4. dahab beach lodge (d12e4317…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع دهب بيتش لودج في منطقة المسبط على الممشى السياحي بمدينة دهب، في موقع مميز قريب من المطاعم والكافيهات والمحلات التجارية ومراكز الغوص. يوفر مكان الإقامة أجواء مريحة مع إمكانية الاستمتاع بالبحر ومنطقة شاطئ خاصة، ويضم غرفًا مكيفة ومطعمًا وحمام سباحة داخليًا وتراسًا، بالإضافة إلى خدمة الواي فاي، ليكون اختيارًا مناسبًا للراغبين في الاستمتاع بأجواء دهب والحياة السياحية في قلب المدينة.

**English description after the split (description_en)**

> Dahab Beach Lodge is located in the Masbat area along Dahab's tourist promenade, close to restaurants, cafés, shops, and diving centers. The property offers a comfortable atmosphere with access to a private beach area. Facilities include air-conditioned rooms, a restaurant, an indoor swimming pool, a terrace, and free Wi-Fi, making it a convenient choice for guests who want to enjoy Dahab's seaside atmosphere and vibrant town life.

## 5. Dahab hills (5d90bdd5…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق دهب هيلز على طريق البلوهول بمدينة دهب، في موقع هادئ يتميز بإطلالات رائعة على البحر الأحمر والجبال المحيطة. يوفر الفندق أجواء مريحة تجمع بين الاسترخاء والاستمتاع بالطبيعة، ويضم غرفًا وأجنحة متنوعة، وحمام سباحة خارجي، ومطعمًا، ومرافق سبا، بالإضافة إلى مركز غوص معتمد من PADI، ليكون مناسبًا لمحبي الهدوء والأنشطة البحرية والمغامرات في دهب.

**English description after the split (description_en)**

> Dahab Hills Hotel is located on Blue Hole Road in Dahab, offering a peaceful setting with beautiful views of the Red Sea and the surrounding mountains. The hotel combines relaxation and natural beauty, featuring a range of rooms and suites, an outdoor swimming pool, a restaurant, spa facilities, and a PADI-certified diving center. It is an appealing choice for guests seeking a relaxing stay and marine adventures in Dahab.

## 6. golden star camp (2eaafe16…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع جولدن ستار كامب في منطقة المسبط بمدينة دهب، في موقع حيوي قريب من الممشى السياحي والشاطئ والمطاعم والمحلات التجارية. يوفر الكامب إقامة بسيطة وهادئة، ويضم غرفًا مكيفة، وحديقة ومساحات مشتركة، مع خدمة واي فاي ومطبخ مشترك، ليكون مناسبًا للباحثين عن إقامة اقتصادية والاستمتاع بأجواء دهب.

**English description after the split (description_en)**

> Golden Star Camp & Hotel is located in the Masbat area of Dahab, in a lively location close to the promenade, beach, restaurants, and local shops. The camp offers simple and relaxing accommodation, with air-conditioned rooms, a garden, shared spaces, Wi-Fi, and a shared kitchen, making it a convenient option for guests looking for an affordable stay in Dahab.

## 7. happy life resort (7b8760d7…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع منتجع هابي لايف دهب في منطقة الثري بولز بمدينة دهب، في موقع مميز على ساحل البحر الأحمر، وسط الطبيعة الخلابة لجبال سيناء وإطلالات البحر الساحرة. يوفر المنتجع أجواء مناسبة للاسترخاء والاستمتاع بالعطلات، ويضم شاطئًا خاصًا وحمامات سباحة ومطاعم، بالإضافة إلى مرافق السبا ومركز للغوص والأنشطة البحرية، ليمنح النزلاء تجربة تجمع بين الراحة والترفيه والاستمتاع بالطبيعة.

**English description after the split (description_en)**

> Happy Life Village Dahab is located in the Three Pools area of Dahab, in a beautiful setting along the Red Sea coast, surrounded by the scenic Sinai Mountains and stunning sea views. The resort offers a relaxing holiday atmosphere, with a private beach, swimming pools, restaurants, spa facilities, and a diving center, providing guests with a blend of comfort, leisure, and marine activities.

## 8. havana house (3e5138e9…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع هافانا هاوس في مدينة دهب، ويوفر إقامة مريحة في أجواء هادئة تناسب الباحثين عن الاستمتاع بالمدينة وشواطئها. يضم مكان الإقامة غرفًا مكيفة بحمامات خاصة، مع غلاية مياه وتلفزيون، وتتوفر شرفات في بعض الغرف. كما تشمل الخدمات مطعمًا وبارًا وخدمة الغرف، مع سهولة الوصول إلى الشاطئ والأنشطة السياحية في دهب.

**English description after the split (description_en)**

> Havana House is located in Dahab and offers comfortable accommodation in a relaxed atmosphere, ideal for guests looking to enjoy the town and its beaches. The property features air-conditioned rooms with private bathrooms, electric kettles, and TVs, while selected rooms include balconies. Guests can also enjoy an on-site restaurant and bar, room service, and convenient access to Dahab Beach and local activities.

## 9. Miamy hotel (44a4ea50…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق ميامي بيتش في مدينة دهب بمنطقة العسلة على طريق البلو هول، في موقع هادئ بالقرب من ساحل البحر الأحمر، ويتميز بقربه من المناطق الطبيعية ومواقع الغوص والسنوركلينج الشهيرة في دهب، مع سهولة الوصول إلى منطقة البلو هول ووادي زغرة، مما يجعله خياراً مناسباً لمحبي الطبيعة والبحر والاستمتاع بالأجواء الهادئة بعيداً عن صخب وسط المدينة.

**English description after the split (description_en)**

> Miami Beach Resort is located in Dahab's Asala area along Blue Hole Road, in a peaceful location near the Red Sea coast. The hotel offers convenient access to Dahab's natural attractions and popular diving and snorkeling spots, including the Blue Hole and Wadi Zaghara, making it a suitable choice for travelers seeking nature, sea activities, and a relaxing atmosphere away from the busy town center.

## 10. monica hotel (88200822…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق مونيكا في منطقة المشربة بمدينة دهب، بالقرب من الممشى السياحي والشاطئ، ويوفر أجواء إقامة هادئة ومريحة تناسب الباحثين عن الاسترخاء والاستمتاع بأجواء المدينة. يضم الفندق حمام سباحة خارجي ومرافق ترفيهية للأطفال، إلى جانب حديقة ومساحات للجلوس وغرف مكيفة، كما يوفر مطعماً وخدمات متنوعة لراحة النزلاء. ويتميز موقعه بسهولة الوصول إلى المطاعم والكافيهات ومراكز الغوص والأنشطة البحرية التي تشتهر بها دهب.

**English description after the split (description_en)**

> Monica Hotel is located in the El Mashraba area of Dahab, close to the tourist promenade and the beach. The hotel offers a relaxing atmosphere with an outdoor swimming pool, children's recreational facilities, a garden, and comfortable air-conditioned rooms. Guests can also enjoy the on-site restaurant and convenient services, while benefiting from easy access to local restaurants, cafés, diving centers, and Dahab's popular marine activities.

## 11. noya house (ff9024e4…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع نويا هاوس في منطقة المشربة بمدينة دهب، بجوار كافيه صحراوي، في موقع مميز قريب من الشاطئ والممشى السياحي والمطاعم والكافيهات. يوفر مكان الإقامة غرفًا مكيفة بحمامات خاصة، مع إطلالات على الجبال، بالإضافة إلى تراس وواي فاي مجاني وخدمة الغرف، ليمنح النزلاء إقامة مريحة بالقرب من أهم مناطق دهب الحيوية.

**English description after the split (description_en)**

> Noya House is located in Dahab’s El Mashraba area, beside Sahrawi Café, in a convenient location close to the beach, promenade, restaurants, and cafés. The property offers air-conditioned rooms with private bathrooms and mountain views, as well as a terrace, free Wi-Fi, and room service, providing guests with a comfortable stay close to Dahab’s main attractions.

## 12. Oricana hotel (d7ce0183…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق أوريكانا في منطقة المشربة بمدينة دهب، في موقع هادئ وقريب من الشاطئ والممشى السياحي والمطاعم والكافيهات ومراكز الغوص. يتميز الفندق بأجوائه البسيطة والمريحة، ويضم غرفًا مكيفة مجهزة بميني بار وتلفزيون، بالإضافة إلى حمام سباحة خارجي ومطعم ومساحات للاسترخاء، ليكون اختيارًا مناسبًا للراغبين في إقامة مريحة واستكشاف معالم دهب.

**English description after the split (description_en)**

> Oricana Hotel is located in Dahab’s El Mashraba area, in a quiet setting close to the beach, promenade, restaurants, cafés, and diving centers. The hotel offers a relaxed atmosphere, with air-conditioned rooms equipped with a minibar and TV, as well as an outdoor swimming pool, restaurant, and leisure areas, making it a convenient choice for guests looking to enjoy a comfortable stay and explore Dahab.

## 13. Remal camp (7002d0ff…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع رمال كامب في موقع مميز بمدينة دهب، في الصف الثاني من البحر والصف الأول من الممشى، مما يجعله قريبًا من مختلف الخدمات والمطاعم والكافيهات. يتميز الكامب بوجود روف يوفر مساحة للاستمتاع بالأجواء، ويضم غرفًا مكيفة ومجهزة بميني بار وغلاية مياه (كاتل). كما يتميز بالنظافة وحداثة المكان، ليكون اختيارًا مناسبًا لإقامة مريحة في قلب دهب.

**English description after the split (description_en)**

> Ramal Camp enjoys a prime location in Dahab, in the second row from the sea and directly on the promenade. It is close to various services, restaurants, and cafés. The camp features a rooftop area and offers air-conditioned rooms equipped with a minibar and an electric kettle. It is clean and newly established, providing guests with a comfortable stay in Dahab.

## 14. Roketa hotel (23078861…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق روكيتا في منطقة المشربة بمدينة دهب، على الممشى السياحي وبالقرب من الشاطئ والمطاعم والكافيهات ومراكز الغوص. يتميز الفندق بتصميمه ذي الطابع النوبي وأجوائه الهادئة، ويوفر غرفًا مكيفة مزودة بحمامات خاصة وميني بار، بالإضافة إلى حمام سباحة ومطعم ومساحات للاسترخاء، ليمنح النزلاء إقامة مريحة بالقرب من أهم مناطق دهب السياحية.

**English description after the split (description_en)**

> Rocketa Hotel is located in Dahab’s El Mashraba area, along the tourist promenade and close to the beach, restaurants, cafés, and diving centers. The hotel features Nubian-inspired architecture and a relaxed atmosphere. It offers air-conditioned rooms with private bathrooms and minibars, as well as a swimming pool, restaurant, and leisure areas for a comfortable stay in Dahab.

## 15. Roots (226a7936…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع روتس كامب في مدينة دهب، ويوفر إقامة بسيطة ومريحة تناسب الباحثين عن أجواء هادئة وتجربة إقامة اقتصادية. يضم الكامب غرفًا مكيفة بحمامات خاصة، بالإضافة إلى مطعم وبار ومواقف للسيارات، مع إمكانية الاستمتاع بالأجواء المميزة لمدينة دهب واستكشاف شواطئها والأنشطة السياحية والبحرية.

**English description after the split (description_en)**

> Roots Camp is located in Dahab and offers simple, comfortable accommodation for guests seeking a relaxed atmosphere and an affordable stay. The camp features air-conditioned rooms with private bathrooms, as well as a restaurant, bar, and parking facilities. Guests can enjoy Dahab's unique atmosphere and explore its beaches and marine activities.

## 16. Safir Dahab Resort (87f0ae04…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> استمتع بإقامة استثنائية في سفير دهب ريزورت، حيث يلتقي سحر البحر الأحمر بجمال جبال سيناء في أجواء من الفخامة والاسترخاء. يتميز المنتجع بموقعه المباشر على البحر وشاطئه الخاص، مع حمامات سباحة وسط مساحات خضراء خلابة، ومجموعة متنوعة من المطاعم والأنشطة الترفيهية والرياضية. سواء كنت تبحث عن عطلة عائلية مميزة أو رحلة مليئة بالاستجمام والمغامرات البحرية، سفير دهب هو وجهتك لتجربة لا تُنسى.

**English description after the split (description_en)**

> Enjoy an exceptional stay at Safir Dahab Resort, where the beauty of the Red Sea meets the breathtaking Sinai Mountains. Set directly along the coast, the resort features a private beach, swimming pools surrounded by lush greenery, a variety of restaurants, and leisure and sports activities. Whether you're planning a memorable family holiday or a relaxing seaside escape filled with marine adventures, Safir Dahab promises a truly special experience.

## 17. Tarakhan hotel (846ab5c5…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق طرخان في مدينة دهب في موقع مميز بالممشى السياحي، حيث تنتشر المطاعم والكافيهات والمحلات التجارية ومراكز الغوص. كما يتيح موقعه سهولة الوصول إلى منطقة اللايت هاوس والاستمتاع بأجواء دهب الساحرة والأنشطة البحرية المختلفة.

**English description after the split (description_en)**

> Tarakhan Hotel is located in Dahab, in a prime location along the tourist promenade, surrounded by restaurants, cafés, shops, and diving centers. Its location also provides easy access to the Lighthouse area, allowing guests to enjoy Dahab's charming atmosphere and various marine activities.

## 18. tropital dahab (6625c9fb…)

Split at: "English Description" heading

**New Arabic description (description_ar)**

> يقع فندق تروبيتل دهب أوازيس على ساحل البحر الأحمر بطريق البلو هول في دهب، وسط طبيعة مميزة تجمع بين مياه البحر الصافية وجبال سيناء الساحرة. يتميز الفندق بإطلالاته البحرية وقربه من موقع البلو هول الشهير للغوص، كما يبعد حوالي 8 كم عن وسط مدينة دهب، مما يوفر للنزلاء أجواء هادئة مناسبة للاسترخاء والاستمتاع بالأنشطة البحرية.

**English description after the split (description_en)**

> Tropitel Dahab Oasis is located along the Red Sea coast on Blue Hole Road in Dahab, surrounded by crystal-clear waters and the beautiful Sinai Mountains. The hotel offers scenic sea views and convenient access to the famous Blue Hole diving site. Located approximately 8 km from Dahab town center, it provides a peaceful setting for guests seeking relaxation and marine activities.
> 
> tropitelhotels.com+1

_Note: the English text ends with the line "tropitelhotels.com+1" (a leftover from the tool that wrote it). It is kept as is; remove it in Admin if you want._

## Not changed — needs the owner's text

**Torino camp dahab (811ec693…)**: its Arabic and English text both describe **Dahab Hills Hotel**, not Torino Camp (a copy-paste from the Dahab Hills entry). Splitting it would only move the wrong text, so it is left exactly as it is. Please replace it in Admin → Stays with Torino's own description.
