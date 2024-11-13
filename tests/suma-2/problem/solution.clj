(defn neteja [s]
    (clojure.string/trim (clojure.string/replace s #"\s+" " ")))

(defn nombres [s]
    (map read-string (clojure.string/split s #" ")))

(defn -main []
    (let [entrada (neteja (slurp *in*))]
        (println (apply + (nombres entrada)))))
