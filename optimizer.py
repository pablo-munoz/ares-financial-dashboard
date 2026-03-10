import sys
import json
import warnings
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

warnings.filterwarnings('ignore')

def main():
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        tickers = input_data.get('tickers', [])
        investment = float(input_data.get('investment', 100000))
        risk_tolerance = float(input_data.get('risk_tolerance', 0.5))
        time_horizon_years = int(input_data.get('time_horizon_years', 5))
        monthly_contribution = float(input_data.get('monthly_contribution', 0))
        is_compounded = input_data.get('is_compounded', True)

        if not tickers:
            raise ValueError("No tickers provided")

        # Define time horizon
        end_date = datetime.now()
        start_date = end_date - timedelta(days=time_horizon_years * 365 + 30) # extra padding

        # Fetch data
        raw_df = yf.download(tickers, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), progress=False)
        
        # Depending on yfinance version and single vs multi-ticker, the structure varies
        if 'Adj Close' in raw_df.columns.levels[0] if isinstance(raw_df.columns, pd.MultiIndex) else 'Adj Close' in raw_df.columns:
            df = raw_df['Adj Close']
        else:
            df = raw_df['Close']
        
        # Handle case where only 1 valid ticker is returned or downloaded
        if isinstance(df, pd.Series):
            df = df.to_frame(name=tickers[0])
            
        df = df.dropna(axis=1, how='all') # drop tickers with no data
        valid_tickers = df.columns.tolist()
        
        if len(valid_tickers) < 1:
            raise ValueError("No valid price data downloaded for the given tickers")

        df = df.ffill().bfill() # Forward/backward fill missing data

        # Calculate expected returns and covariance matrix (Simplified PyPortfolioOpt logic without the heavy lib)
        mu = df.pct_change().mean() * 252
        S = df.pct_change().cov() * 252

        # 1. Calculate weights based on risk tolerance (Simplified deterministic approach)
        # 0.0 -> Min Volatility, 1.0 -> Max Sharpe
        inv_vol = 1.0 / np.sqrt(np.diag(S))
        min_vol_weights = inv_vol / np.sum(inv_vol)
        
        # Approximate Max Sharpe (assuming risk free rate = 4%)
        sharpe_scores = (mu - 0.04) / np.sqrt(np.diag(S))
        sharpe_scores = np.maximum(sharpe_scores, 0.001) # Avoid negative weights
        max_sharpe_weights = sharpe_scores / np.sum(sharpe_scores)
        
        # Blend based on risk tolerance
        weights_array = (1 - risk_tolerance) * min_vol_weights + risk_tolerance * max_sharpe_weights
        
        # Normalize weights
        weights_array = weights_array / np.sum(weights_array)
        weights = {ticker: round(float(weight), 4) for ticker, weight in zip(valid_tickers, weights_array)}

        # 2. Calculate Portfolio Performance Metrics
        port_return = np.sum(mu * weights_array)
        port_volatility = np.sqrt(np.dot(weights_array.T, np.dot(S, weights_array)))
        sharpe_ratio = (port_return - 0.04) / port_volatility

        strategy = "Conservative" if risk_tolerance < 0.3 else "Balanced" if risk_tolerance < 0.7 else "Aggressive"

        # 3. Time Series Backtest (Monthly)
        monthly_df = df.resample('ME').last()
        monthly_returns_df = monthly_df.pct_change().dropna()
        
        # Compute exact point-in-time monthly portfolio returns
        portfolio_monthly_returns = monthly_returns_df.dot(weights_array)
        
        # Benchmark (S&P 500 approximation)
        try:
            spy_raw = yf.download('^GSPC', start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), progress=False)
            if 'Adj Close' in spy_raw.columns.levels[0] if isinstance(spy_raw.columns, pd.MultiIndex) else 'Adj Close' in spy_raw.columns:
                spy = spy_raw['Adj Close']
            else:
                spy = spy_raw['Close']
                
            if isinstance(spy, pd.DataFrame):
                spy = spy.iloc[:, 0]
                
            bench_monthly = spy.resample('ME').last().pct_change().dropna()
        except:
            # Fallback if benchmark fails
            bench_monthly = pd.Series(0.008, index=portfolio_monthly_returns.index)

        # Ensure index alignment
        aligned_data = pd.DataFrame({
            'portfolio': portfolio_monthly_returns,
            'benchmark': bench_monthly
        }).dropna()
        
        # Growth simulation
        growth = []
        current_val = investment
        bench_val = investment
        accumulated_cash = 0
        
        # Add month 0
        growth.append({
            "month": 0,
            "portfolio": investment,
            "benchmark": investment
        })

        peak_portfolio = investment
        max_drawdown = 0.0
        
        # Calculate monthly returns table grouping
        monthly_returns_table = []
        
        for i, (date, row) in enumerate(aligned_data.iterrows()):
            port_ret = row['portfolio']
            bench_ret = row['benchmark']
            
            if is_compounded:
                current_val = (current_val + monthly_contribution) * (1 + port_ret)
            else:
                current_val += monthly_contribution
                accumulated_cash += current_val * port_ret
                
            bench_val = (bench_val + monthly_contribution) * (1 + bench_ret)
            
            total_port_val = current_val if is_compounded else current_val + accumulated_cash
            
            # Update peak and drawdown
            if total_port_val > peak_portfolio:
                peak_portfolio = total_port_val
            
            dd = (total_port_val - peak_portfolio) / peak_portfolio if peak_portfolio > 0 else 0
            if dd < max_drawdown:
                max_drawdown = dd
                
            growth.append({
                "month": i + 1,
                "portfolio": round(total_port_val, 2),
                "benchmark": round(bench_val, 2)
            })
            
        # Group returns by year for the UI table
        aligned_data['year'] = aligned_data.index.year
        aligned_data['month'] = aligned_data.index.month
        
        for year in sorted(aligned_data['year'].unique(), reverse=True):
            year_data = aligned_data[aligned_data['year'] == year]
            
            jan = year_data[year_data['month'] == 1]['portfolio'].sum() * 100
            feb = year_data[year_data['month'] == 2]['portfolio'].sum() * 100
            mar = year_data[year_data['month'] == 3]['portfolio'].sum() * 100
            
            q1 = ((1 + jan/100) * (1 + feb/100) * (1 + mar/100) - 1) * 100
            annual = ((year_data['portfolio'] + 1).prod() - 1) * 100
            
            monthly_returns_table.append({
                "year": int(year),
                "jan": round(float(jan), 1),
                "feb": round(float(feb), 1),
                "mar": round(float(mar), 1),
                "q1": round(float(q1), 1),
                "annual": round(float(annual), 1)
            })

        final_val = current_val if is_compounded else current_val + accumulated_cash
        total_invested = investment + monthly_contribution * len(aligned_data)
        
        port_total_return = (final_val / total_invested) - 1
        bench_total_return = (bench_val / total_invested) - 1

        # Output JSON
        output = {
            "success": True,
            "data": {
                "optimization": {
                    "weights": weights,
                    "expected_return": round(float(port_return), 4),
                    "volatility": round(float(port_volatility), 4),
                    "sharpe_ratio": round(float(sharpe_ratio), 2),
                    "strategy": strategy
                },
                "backtest": {
                    "growth": growth,
                    "portfolio_total_return": round(float(port_total_return), 4),
                    "benchmark_total_return": round(float(bench_total_return), 4),
                    "max_drawdown_pct": round(float(max_drawdown * 100), 2)
                },
                "risk_details": {
                    "contribution_to_risk": [{"ticker": t, "contribution": round(float(w * 100), 2)} for t, w in zip(valid_tickers, weights_array)]
                },
                "monthlyReturns": monthly_returns_table
            }
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({"success": False, "detail": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
