import { CARDS, type CardId } from './model';
import { BADGES, type RecordBook } from './storage';
import { CardGlyph } from './art';
export function Reference({ book, notice }: { book: RecordBook; notice: string }) {
return <>
          <aside className="notes">
            <p className="section-label">02 / TACTICAL NOTES</p>
            <h2>仕込みが、戦術になる。</h2>
            <div className="tactic">
              <b>速醸型 → 序盤から安定</b>
              <p>
                初期補給8と防御10%。早めの砲台配置で前線を作り、支援を重ねる。
              </p>
            </div>
            <div className="tactic">
              <b>生酛型 → 育てた守り</b>
              <p>
                初期補給5、防御なし。拠点を守って育成100にすると、以後は被ダメージ35%軽減。完成してから押し返す。
              </p>
            </div>
            <p className="fiction-note">
              これは遊びのための能力差です。現実の生酛の安全性や防御力を表しません。
            </p>
            <details>
              <summary>6枚のカードと相性</summary>
              {Object.entries(CARDS).map(([id, c]) => (
                <div className="card-guide" key={id}>
                  <CardGlyph kind={id as CardId} small />
                  <div>
                    <b>
                      {c.name} <small>補給{c.cost}</small>
                    </b>
                    <p>{c.description}</p>
                  </div>
                </div>
              ))}
            </details>
            <details>
              <summary>勝敗・補給・配置ルール</summary>
              <p>
                75秒終了時に陣地が多い側が勝利。同数は引き分け。85%以上を3秒連続で保つと早期勝利です。
              </p>
              <p>
                補給は毎秒0.95、上限10。ユニットは自分の色へ配置。「櫂入れ」だけは敵陣にも使えます。使用したカードは山札の最後に戻り、次のカードが手札に入ります。
              </p>
              <p>
                弾は敵に当たるか寿命まで進み、種類に応じて壁で反射。ユニットにはHPと活動時間があり、消える前に次の部隊を用意する必要があります。
              </p>
              <p>
                生酛の育成は毎秒0.6、乳酸菌の拠点1つにつき+1.4（3つまで）。配置成功でも+2。拠点を失うと育成速度が下がります。完成後の防御は対戦終了まで維持。
              </p>
            </details>
          </aside>        <section className="record-book">
          <div>
            <p className="section-label">YOUR BREWERY RECORD</p>
            <h2>次の一手を、強くする。</h2>
            <p>{notice}</p>
          </div>
          <div className="record-values">
            <div>
              <span>勝利 / 対戦</span>
              <b data-testid="wins">
                {book.wins}
                <small> / {book.runs}</small>
              </b>
            </div>
            <div>
              <span>速醸型 BEST</span>
              <b data-testid="best-sokujo">
                {book.best.sokujo.toLocaleString()}
              </b>
            </div>
            <div>
              <span>生酛型 BEST</span>
              <b data-testid="best-kimoto">
                {book.best.kimoto.toLocaleString()}
              </b>
            </div>
          </div>
          <div className="badges">
            {BADGES.map((b) => (
              <span
                key={b}
                className={book.badges.includes(b) ? 'unlocked' : ''}
              >
                {book.badges.includes(b) ? '✓' : '○'} {b}
              </span>
            ))}
          </div>
        </section>
        <section className="science">
          <p className="section-label">03 / GAME & REAL BREWING</p>
          <h2>酒をテーマに。ルールは架空に。</h2>
          <p>このゲームは仕込み・飲用可否・菌数・酒質を判定しません。</p>
          <details>
            <summary>速醸・生酛の出典とゲームの境界</summary>
            <p>
              <b>出典で確認：</b>
              生酛系では乳酸菌がつくる乳酸を利用し、速醸系では醸造用乳酸を使います。
              <a
                href="https://www.nrib.go.jp/sake/sakefaq02.html"
                target="_blank"
                rel="noreferrer"
              >
                酒類総合研究所「清酒」↗
              </a>
              （2026-09-07確認）
            </p>
            <p>
              <b>教育用の簡略化：</b>
              乳酸を得る過程の違いを「最初から支援がある／育てて支援を得る」という対比にしています。
            </p>
            <p>
              <b>架空のゲーム係数：</b>
              育成時間、補給、塗り、攻撃、防御10%・35%、修復、ユニットの動き、勝敗はすべて架空です。実際の生酛が一律に安全・頑丈・高品質になるという説明ではありません。
            </p>
          </details>
        </section>

</>;
}
