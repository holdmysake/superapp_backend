import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Trunkline from './trunkline.model.js'

const Spot = sequelize.define('spot', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    spot_id: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true,
    },
    spot_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tline_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: Trunkline,
            key: 'tline_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    sort: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    is_seen: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    is_battery: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    y_max: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    y_interval: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    safe_mark: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    drop_value: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    normal_value: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    kp_pos: {
        type: DataTypes.FLOAT,
        allowNull: true
    }
}, {
    tableName: 'spot',
    timestamps: false,
    underscored: true
})

export default Spot
